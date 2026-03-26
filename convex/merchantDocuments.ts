import { v } from "convex/values";
import type {
	MerchantDocumentRecord,
	MerchantKnowledgeDocumentsData,
} from "../src/shared/contracts/merchant-workspace";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx,
} from "./_generated/server";
import { requireMerchantActor, requireMerchantClaims } from "./auth";
import { documentStorage } from "./documentStorage";
import {
	MAX_DOCUMENT_UPLOAD_BYTES,
	MAX_INLINE_DOCUMENT_CHARS,
	detectDocumentFormat,
	isSupportedDocumentUpload,
	normalizeDocumentTitle,
	previewText,
	searchTextForChunk,
	searchTextForDocument,
	summarizeDocument,
	type KnowledgeDocumentVisibility,
} from "./merchantKnowledgeShared";

const DOCUMENT_REINDEX_JOB = "document_reindex";
const PROCESSING_PLACEHOLDER_PREVIEW = "Queued for parsing, chunking, and indexing.";
const PROCESSING_PLACEHOLDER_SUMMARY =
	"Queued for document processing. The knowledge index will update when parsing completes.";

type DocumentChunkRow = Doc<"merchantDocumentChunks">;
type DocumentWorkflowResult = { jobId: Id<"syncJobs">; ok: true };
type UploadedDocumentResult = {
	documentId: Id<"merchantDocuments">;
	jobId: Id<"syncJobs">;
	ok: true;
};

function scopeKeyForDocument(args: {
	shopId: Id<"shops">;
	visibility: KnowledgeDocumentVisibility;
}) {
	return `${args.shopId}:${args.visibility}`;
}

function toDocumentRecord(document: Doc<"merchantDocuments">): MerchantDocumentRecord {
	return {
		chunkCount: document.chunkCount ?? null,
		contentPreview: document.contentPreview,
		failureReason: document.failureReason ?? null,
		fileName: document.fileName ?? null,
		id: document._id,
		sourceType: document.sourceType,
		status: document.status,
		summary: document.summary,
		title: document.title,
		updatedAt: new Date(document.updatedAt).toISOString(),
		visibility: document.visibility,
	};
}

function assertSupportedBlobUpload(args: { fileName: string; mimeType?: string; size: number }) {
	if (args.fileName.trim().length < 3) {
		throw new Error("Choose a file with a readable filename before uploading.");
	}

	if (!Number.isFinite(args.size) || args.size <= 0) {
		throw new Error("Uploaded files must have a positive file size.");
	}

	if (args.size > MAX_DOCUMENT_UPLOAD_BYTES) {
		throw new Error("Document uploads are currently limited to 12 MB.");
	}

	if (!isSupportedDocumentUpload(args)) {
		throw new Error("Supported document uploads are PDF, TXT, Markdown, DOCX, and CSV.");
	}
}

function inferInlineMimeType(args: { fileName?: string; mimeType?: string }) {
	const format = detectDocumentFormat(args);

	switch (format) {
		case "markdown":
			return "text/markdown";
		case "csv":
			return "text/csv";
		default:
			return "text/plain";
	}
}

async function queueDocumentReindex(
	ctx: MutationCtx,
	args: {
		domain: string;
		payloadPreview: string;
		pendingReason: string;
		shopId: Id<"shops">;
		source: string;
	},
): Promise<Id<"syncJobs">> {
	return await ctx.runMutation(internal.shopifySync.queueSyncJob, {
		domain: args.domain,
		payloadPreview: args.payloadPreview,
		pendingReason: args.pendingReason,
		shopId: args.shopId,
		source: args.source,
		type: DOCUMENT_REINDEX_JOB,
	});
}

async function deleteChunkRowsForDocument(ctx: MutationCtx, documentId: Id<"merchantDocuments">) {
	while (true) {
		const batch = await ctx.db
			.query("merchantDocumentChunks")
			.withIndex("by_document_and_chunk_number", (query) => query.eq("documentId", documentId))
			.take(64);

		if (batch.length === 0) {
			break;
		}

		for (const row of batch) {
			await ctx.db.delete(row._id);
		}
	}
}

export const listProcessingDocuments = internalQuery({
	args: {
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("merchantDocuments")
			.withIndex("by_shop_and_status_and_updated_at", (query) =>
				query.eq("shopId", args.shopId).eq("status", "processing"),
			)
			.order("desc")
			.take(64);
	},
});

export const markDocumentProcessing = internalMutation({
	args: {
		documentId: v.id("merchantDocuments"),
	},
	handler: async (ctx, args) => {
		const document = await ctx.db.get(args.documentId);

		if (!document) {
			return null;
		}

		const now = Date.now();
		await ctx.db.patch(document._id, {
			chunkCount: undefined,
			contentPreview: PROCESSING_PLACEHOLDER_PREVIEW,
			contentTruncated: undefined,
			failureReason: undefined,
			parsedCharacterCount: undefined,
			processingQueuedAt: document.processingQueuedAt ?? now,
			processingStartedAt: now,
			status: "processing",
			summary: PROCESSING_PLACEHOLDER_SUMMARY,
			updatedAt: now,
		});

		return document._id;
	},
});

export const markDocumentReady = internalMutation({
	args: {
		content: v.optional(v.string()),
		contentPreview: v.string(),
		contentTruncated: v.boolean(),
		documentId: v.id("merchantDocuments"),
		parsedCharacterCount: v.number(),
		searchText: v.string(),
		summary: v.string(),
	},
	handler: async (ctx, args) => {
		const document = await ctx.db.get(args.documentId);

		if (!document) {
			return null;
		}

		const chunkCount = (
			await ctx.db
				.query("merchantDocumentChunks")
				.withIndex("by_document_and_chunk_number", (query) => query.eq("documentId", document._id))
				.take(256)
		).length;
		const now = Date.now();

		await ctx.db.patch(document._id, {
			chunkCount,
			content: args.content,
			contentPreview: args.contentPreview,
			contentTruncated: args.contentTruncated,
			failureReason: undefined,
			lastProcessedAt: now,
			parsedCharacterCount: args.parsedCharacterCount,
			searchText: args.searchText,
			status: "ready",
			summary: args.summary,
			updatedAt: now,
		});

		return document._id;
	},
});

export const markDocumentFailed = internalMutation({
	args: {
		documentId: v.id("merchantDocuments"),
		reason: v.string(),
	},
	handler: async (ctx, args) => {
		const document = await ctx.db.get(args.documentId);

		if (!document) {
			return null;
		}

		await deleteChunkRowsForDocument(ctx, document._id);
		await ctx.db.patch(document._id, {
			chunkCount: 0,
			contentPreview: previewText(args.reason),
			failureReason: args.reason,
			status: "failed",
			summary: "Document processing failed. Review the failure reason and retry the workflow.",
			updatedAt: Date.now(),
		});

		return document._id;
	},
});

export const clearDocumentChunks = internalMutation({
	args: {
		documentId: v.id("merchantDocuments"),
	},
	handler: async (ctx, args) => {
		await deleteChunkRowsForDocument(ctx, args.documentId);
		return true;
	},
});

export const insertDocumentChunkBatch = internalMutation({
	args: {
		chunks: v.array(
			v.object({
				chunkNumber: v.number(),
				charEnd: v.number(),
				charStart: v.number(),
				embedding: v.array(v.number()),
				embeddingModel: v.string(),
				fileName: v.optional(v.string()),
				searchText: v.string(),
				snippet: v.string(),
				text: v.string(),
				title: v.string(),
				visibility: v.union(v.literal("public"), v.literal("shop_private")),
			}),
		),
		documentId: v.id("merchantDocuments"),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		for (const chunk of args.chunks) {
			await ctx.db.insert("merchantDocumentChunks", {
				chunkNumber: chunk.chunkNumber,
				charEnd: chunk.charEnd,
				charStart: chunk.charStart,
				createdAt: now,
				documentId: args.documentId,
				embedding: chunk.embedding,
				embeddingModel: chunk.embeddingModel,
				fileName: chunk.fileName,
				scopeKey: scopeKeyForDocument({
					shopId: args.shopId,
					visibility: chunk.visibility,
				}),
				searchText: searchTextForChunk({
					fileName: chunk.fileName,
					text: chunk.searchText,
					title: chunk.title,
				}),
				shopId: args.shopId,
				snippet: chunk.snippet,
				text: chunk.text,
				title: chunk.title,
				updatedAt: now,
				visibility: chunk.visibility,
			});
		}

		return args.chunks.length;
	},
});

export const appendWorkflowLog = internalMutation({
	args: {
		detail: v.optional(v.string()),
		jobId: v.id("syncJobs"),
		level: v.union(v.literal("error"), v.literal("info"), v.literal("success"), v.literal("watch")),
		message: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("workflowLogs", {
			createdAt: Date.now(),
			detail: args.detail,
			jobId: args.jobId,
			level: args.level,
			message: args.message,
			shopId: args.shopId,
		});

		return true;
	},
});

export const createDocumentRecord = internalMutation({
	args: {
		byteLength: v.optional(v.number()),
		content: v.optional(v.string()),
		contentPreview: v.string(),
		fileName: v.optional(v.string()),
		mimeType: v.optional(v.string()),
		searchText: v.string(),
		shopId: v.id("shops"),
		sourceType: v.string(),
		status: v.union(v.literal("failed"), v.literal("processing"), v.literal("ready")),
		summary: v.string(),
		title: v.string(),
		uploadedByActorId: v.id("merchantActors"),
		visibility: v.union(v.literal("public"), v.literal("shop_private")),
		r2Key: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		return await ctx.db.insert("merchantDocuments", {
			byteLength: args.byteLength,
			content: args.content,
			contentPreview: args.contentPreview,
			createdAt: now,
			fileName: args.fileName,
			mimeType: args.mimeType,
			processingQueuedAt: now,
			r2Key: args.r2Key,
			searchText: args.searchText,
			shopId: args.shopId,
			sourceType: args.sourceType,
			status: args.status,
			summary: args.summary,
			title: args.title,
			updatedAt: now,
			uploadedByActorId: args.uploadedByActorId,
			visibility: args.visibility,
		});
	},
});

export const searchKnowledgeChunksByText = internalQuery({
	args: {
		limit: v.optional(v.number()),
		query: v.string(),
		shopId: v.id("shops"),
		visibility: v.union(v.literal("public"), v.literal("shop_private")),
	},
	handler: async (ctx, args) => {
		const searchTerm = args.query.trim();
		const limit = Math.min(Math.max(args.limit ?? 6, 1), 12);

		if (searchTerm.length < 2) {
			return [] as DocumentChunkRow[];
		}

		return (await ctx.db
			.query("merchantDocumentChunks")
			.withSearchIndex("search_text", (query) =>
				query
					.search("searchText", searchTerm)
					.eq("shopId", args.shopId)
					.eq("visibility", args.visibility),
			)
			.take(limit)) as DocumentChunkRow[];
	},
});

export const hydrateKnowledgeChunks = internalQuery({
	args: {
		chunkIds: v.array(v.id("merchantDocumentChunks")),
	},
	handler: async (ctx, args) => {
		const rows = (await Promise.all(args.chunkIds.map((chunkId) => ctx.db.get(chunkId)))).filter(
			(row): row is DocumentChunkRow => Boolean(row),
		);
		const documentIds = Array.from(new Set(rows.map((row) => row.documentId)));
		const documents = (
			await Promise.all(documentIds.map((documentId) => ctx.db.get(documentId)))
		).filter((row): row is Doc<"merchantDocuments"> => Boolean(row));
		const documentMap = new Map(documents.map((document) => [document._id, document]));

		return args.chunkIds
			.map((chunkId) => rows.find((row) => row._id === chunkId) ?? null)
			.filter((row): row is DocumentChunkRow => Boolean(row))
			.map((row) => ({
				chunkId: row._id,
				chunkNumber: row.chunkNumber,
				document: documentMap.get(row.documentId) ?? null,
				documentId: row.documentId,
				snippet: row.snippet,
				text: row.text,
				visibility: row.visibility,
			}));
	},
});

export const knowledgeDocuments = query({
	args: {},
	handler: async (ctx): Promise<MerchantKnowledgeDocumentsData> => {
		const { shop } = await requireMerchantActor(ctx);
		const rows = await ctx.db
			.query("merchantDocuments")
			.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", shop._id))
			.order("desc")
			.take(25);

		return {
			documents: rows.map(toDocumentRecord),
			generatedAt: new Date().toISOString(),
		};
	},
});

export const beginDocumentUpload = mutation({
	args: {
		fileName: v.string(),
		mimeType: v.optional(v.string()),
		size: v.number(),
	},
	handler: async (ctx, args) => {
		await requireMerchantActor(ctx);
		assertSupportedBlobUpload(args);
		return await documentStorage.generateUploadUrl();
	},
});

export const finalizeDocumentUpload = action({
	args: {
		fileName: v.optional(v.string()),
		key: v.string(),
		mimeType: v.optional(v.string()),
		size: v.optional(v.number()),
		title: v.string(),
		visibility: v.union(v.literal("public"), v.literal("shop_private")),
	},
	handler: async (ctx, args): Promise<UploadedDocumentResult> => {
		const claims = await requireMerchantClaims(ctx);
		const fileName = args.fileName?.trim() || undefined;
		const mimeType = args.mimeType?.trim() || undefined;
		const title = normalizeDocumentTitle(args.title);

		if (title.length < 3) {
			throw new Error("Document title must be at least 3 characters.");
		}

		assertSupportedBlobUpload({
			fileName: fileName ?? "upload",
			mimeType,
			size: args.size ?? 1,
		});
		await documentStorage.syncMetadata(ctx, args.key);

		const documentId: Id<"merchantDocuments"> = await ctx.runMutation(
			internal.merchantDocuments.createDocumentRecord,
			{
				byteLength: args.size,
				contentPreview: PROCESSING_PLACEHOLDER_PREVIEW,
				fileName,
				mimeType,
				r2Key: args.key,
				searchText: title,
				shopId: claims.shopId,
				sourceType: "blob_upload",
				status: "processing",
				summary: PROCESSING_PLACEHOLDER_SUMMARY,
				title,
				uploadedByActorId: claims.merchantActorId,
				visibility: args.visibility,
			},
		);
		const jobId: Id<"syncJobs"> = await ctx.runMutation(internal.shopifySync.queueSyncJob, {
			domain: claims.shopDomain,
			payloadPreview: `Queued document processing for ${title}.`,
			pendingReason: `Merchant uploaded ${fileName ?? "a document"} for parsing and indexing.`,
			shopId: claims.shopId,
			source: "merchant_documents",
			type: DOCUMENT_REINDEX_JOB,
		});

		await ctx.runMutation(internal.merchantWorkspace.recordAuditLog, {
			action: "merchant.document.uploaded",
			actorId: claims.merchantActorId,
			detail: `Uploaded knowledge document ${title}.`,
			payload: {
				documentId,
				fileName,
				jobId,
				visibility: args.visibility,
			},
			shopId: claims.shopId,
			status: "pending",
		});

		return {
			documentId,
			jobId,
			ok: true,
		};
	},
});

export const uploadInlineDocument = action({
	args: {
		content: v.string(),
		fileName: v.optional(v.string()),
		mimeType: v.optional(v.string()),
		title: v.string(),
		visibility: v.union(v.literal("public"), v.literal("shop_private")),
	},
	handler: async (ctx, args): Promise<UploadedDocumentResult> => {
		const claims = await requireMerchantClaims(ctx);
		const title = normalizeDocumentTitle(args.title);
		const content = args.content.trim();
		const fileName = args.fileName?.trim() || undefined;

		if (title.length < 3) {
			throw new Error("Document title must be at least 3 characters.");
		}

		if (content.length < 24) {
			throw new Error("Paste more document text so the knowledge index has enough context.");
		}

		if (content.length > MAX_INLINE_DOCUMENT_CHARS) {
			throw new Error("Inline document uploads are limited to 120,000 characters.");
		}

		const mimeType = inferInlineMimeType({
			fileName,
			mimeType: args.mimeType,
		});
		const key = await documentStorage.store(
			ctx,
			new Blob([content], {
				type: mimeType,
			}),
			{
				type: mimeType,
			},
		);
		const documentId: Id<"merchantDocuments"> = await ctx.runMutation(
			internal.merchantDocuments.createDocumentRecord,
			{
				byteLength: content.length,
				content,
				contentPreview: previewText(content),
				fileName,
				mimeType,
				r2Key: key,
				searchText: searchTextForDocument({
					content,
					fileName,
					title,
				}),
				shopId: claims.shopId,
				sourceType: "inline_upload",
				status: "processing",
				summary: summarizeDocument(content),
				title,
				uploadedByActorId: claims.merchantActorId,
				visibility: args.visibility,
			},
		);
		const jobId: Id<"syncJobs"> = await ctx.runMutation(internal.shopifySync.queueSyncJob, {
			domain: claims.shopDomain,
			payloadPreview: `Queued document processing for ${title}.`,
			pendingReason: "Merchant uploaded inline text for document parsing and indexing.",
			shopId: claims.shopId,
			source: "merchant_documents",
			type: DOCUMENT_REINDEX_JOB,
		});

		await ctx.runMutation(internal.merchantWorkspace.recordAuditLog, {
			action: "merchant.document.uploaded",
			actorId: claims.merchantActorId,
			detail: `Uploaded inline knowledge document ${title}.`,
			payload: {
				documentId,
				fileName,
				jobId,
				visibility: args.visibility,
			},
			shopId: claims.shopId,
			status: "pending",
		});

		return {
			documentId,
			jobId,
			ok: true,
		};
	},
});

export const deleteDocument = mutation({
	args: {
		documentId: v.id("merchantDocuments"),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const document = await ctx.db.get(args.documentId);

		if (!document || document.shopId !== shop._id) {
			throw new Error("Document not found.");
		}

		await deleteChunkRowsForDocument(ctx, document._id);

		if (document.r2Key) {
			await documentStorage.deleteObject(ctx, document.r2Key);
		}

		await ctx.db.delete(document._id);
		await ctx.db.insert("auditLogs", {
			action: "merchant.document.deleted",
			actorId: actor._id,
			createdAt: Date.now(),
			detail: `Deleted merchant knowledge document ${document.title}.`,
			payload: {
				documentId: document._id,
				fileName: document.fileName,
				r2Key: document.r2Key,
			},
			shopId: shop._id,
			status: "success",
		});

		return {
			ok: true,
		};
	},
});

export const updateDocumentVisibility = mutation({
	args: {
		documentId: v.id("merchantDocuments"),
		visibility: v.union(v.literal("public"), v.literal("shop_private")),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const document = await ctx.db.get(args.documentId);

		if (!document || document.shopId !== shop._id) {
			throw new Error("Document not found.");
		}

		const now = Date.now();
		await ctx.db.patch(document._id, {
			updatedAt: now,
			visibility: args.visibility,
		});

		const chunkRows = await ctx.db
			.query("merchantDocumentChunks")
			.withIndex("by_document_and_chunk_number", (query) => query.eq("documentId", document._id))
			.take(256);

		for (const row of chunkRows) {
			await ctx.db.patch(row._id, {
				scopeKey: scopeKeyForDocument({
					shopId: shop._id,
					visibility: args.visibility,
				}),
				updatedAt: now,
				visibility: args.visibility,
			});
		}

		await ctx.db.insert("auditLogs", {
			action: "merchant.document.visibility_updated",
			actorId: actor._id,
			createdAt: now,
			detail: `Changed document visibility for ${document.title} to ${args.visibility}.`,
			payload: {
				documentId: document._id,
				visibility: args.visibility,
			},
			shopId: shop._id,
			status: "success",
		});

		return {
			ok: true,
		};
	},
});

export const reprocessDocument = mutation({
	args: {
		documentId: v.id("merchantDocuments"),
	},
	handler: async (ctx, args): Promise<DocumentWorkflowResult> => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const document = await ctx.db.get(args.documentId);

		if (!document || document.shopId !== shop._id) {
			throw new Error("Document not found.");
		}

		const now = Date.now();
		await ctx.db.patch(document._id, {
			chunkCount: undefined,
			contentPreview: PROCESSING_PLACEHOLDER_PREVIEW,
			contentTruncated: undefined,
			failureReason: undefined,
			parsedCharacterCount: undefined,
			processingQueuedAt: now,
			status: "processing",
			summary: PROCESSING_PLACEHOLDER_SUMMARY,
			updatedAt: now,
		});
		const jobId: Id<"syncJobs"> = await queueDocumentReindex(ctx, {
			domain: shop.domain,
			payloadPreview: `Queued document processing for ${document.title}.`,
			pendingReason: `Merchant requested a retry for ${document.title}.`,
			shopId: shop._id,
			source: "merchant_documents",
		});

		await ctx.db.insert("auditLogs", {
			action: "merchant.document.reprocess_requested",
			actorId: actor._id,
			createdAt: now,
			detail: `Queued document reprocessing for ${document.title}.`,
			payload: {
				documentId: document._id,
				jobId,
			},
			shopId: shop._id,
			status: "pending",
		});

		return {
			jobId,
			ok: true,
		};
	},
});

export const reprocessDocuments = mutation({
	args: {},
	handler: async (ctx): Promise<DocumentWorkflowResult> => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const rows = await ctx.db
			.query("merchantDocuments")
			.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", shop._id))
			.take(64);
		const now = Date.now();

		for (const row of rows) {
			await ctx.db.patch(row._id, {
				chunkCount: undefined,
				contentPreview: PROCESSING_PLACEHOLDER_PREVIEW,
				contentTruncated: undefined,
				failureReason: undefined,
				parsedCharacterCount: undefined,
				processingQueuedAt: now,
				status: "processing",
				summary: PROCESSING_PLACEHOLDER_SUMMARY,
				updatedAt: now,
			});
		}

		const jobId: Id<"syncJobs"> = await queueDocumentReindex(ctx, {
			domain: shop.domain,
			payloadPreview: "Queued a shop-wide document processing run.",
			pendingReason: "Merchant requested document re-indexing.",
			shopId: shop._id,
			source: "merchant_documents",
		});

		await ctx.db.insert("auditLogs", {
			action: "merchant.document.reindex_requested",
			actorId: actor._id,
			createdAt: now,
			detail: "Merchant requested document re-index workflow.",
			payload: {
				jobId,
				documentCount: rows.length,
			},
			shopId: shop._id,
			status: "pending",
		});

		return {
			jobId,
			ok: true,
		};
	},
});
