"use node";

import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { v } from "convex/values";
import JSZip from "jszip";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, type ActionCtx } from "./_generated/server";
import { documentStorage } from "./documentStorage";
import {
	DOCUMENT_EMBEDDING_MODEL,
	buildDocumentCitation,
	chunkDocumentText,
	detectDocumentFormat,
	normalizeDocumentText,
	normalizeMarkdownText,
	previewText,
	searchTextForDocument,
	summarizeDocument,
	truncateStoredDocumentContent,
	type ExtractedDocumentFormat,
	type KnowledgeDocumentVisibility,
} from "./merchantKnowledgeShared";
import { PDFParse } from "./pdfParseCompat";

type KnowledgeMatch = {
	chunkId: Id<"merchantDocumentChunks">;
	chunkNumber: number;
	citation: ReturnType<typeof buildDocumentCitation>;
	documentId: Id<"merchantDocuments">;
	snippet: string;
	text: string;
	title: string;
	visibility: KnowledgeDocumentVisibility;
};

type MerchantDocumentsActionCtx = ActionCtx;
type HydratedKnowledgeChunk = {
	chunkId: Id<"merchantDocumentChunks">;
	chunkNumber: number;
	document: Doc<"merchantDocuments"> | null;
	documentId: Id<"merchantDocuments">;
	snippet: string;
	text: string;
	visibility: KnowledgeDocumentVisibility;
};

type ReadyHydratedKnowledgeChunk = HydratedKnowledgeChunk & {
	document: Doc<"merchantDocuments">;
};

function getEnv(name: string) {
	return (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env?.[name];
}

function getOptionalAiApiKey() {
	return getEnv("CONVEX_OPENAI_API_KEY") ?? getEnv("OPENAI_API_KEY") ?? null;
}

function getEmbeddingModel() {
	const apiKey = getOptionalAiApiKey();

	if (!apiKey) {
		return null;
	}

	const openai = createOpenAI({
		apiKey,
	});

	return openai.textEmbeddingModel(DOCUMENT_EMBEDDING_MODEL);
}

function decodeXmlEntities(value: string) {
	return value
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, "&");
}

async function extractDocxText(data: ArrayBuffer) {
	const zip = await JSZip.loadAsync(data);
	const documentXml = await zip.file("word/document.xml")?.async("string");

	if (!documentXml) {
		throw new Error("The DOCX file is missing word/document.xml.");
	}

	return normalizeDocumentText(
		decodeXmlEntities(
			documentXml
				.replace(/<w:tab\/>/g, "\t")
				.replace(/<w:br[^>]*\/>/g, "\n")
				.replace(/<w:cr[^>]*\/>/g, "\n")
				.replace(/<\/w:p>/g, "\n\n")
				.replace(/<[^>]+>/g, " "),
		),
	);
}

async function fetchDocumentBytes(document: Doc<"merchantDocuments">) {
	if (document.r2Key) {
		const url = await documentStorage.getUrl(document.r2Key, {
			expiresIn: 60 * 10,
		});
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`R2 returned ${response.status} while loading the document blob.`);
		}

		return {
			data: await response.arrayBuffer(),
			mimeType: document.mimeType ?? response.headers.get("content-type") ?? undefined,
		};
	}

	if (document.content) {
		return {
			data: new TextEncoder().encode(document.content).buffer,
			mimeType: document.mimeType ?? "text/plain",
		};
	}

	throw new Error("No raw document blob or fallback text is available for parsing.");
}

async function extractDocumentText(args: { data: ArrayBuffer; format: ExtractedDocumentFormat }) {
	switch (args.format) {
		case "pdf": {
			const parser = new PDFParse({
				data: args.data,
			});
			const result = await parser.getText();
			await parser.destroy();
			return normalizeDocumentText(result.text);
		}
		case "docx": {
			return await extractDocxText(args.data);
		}
		case "markdown": {
			return normalizeMarkdownText(new TextDecoder().decode(args.data));
		}
		case "csv":
		case "text": {
			return normalizeDocumentText(new TextDecoder().decode(args.data));
		}
	}
}

async function processDocument(
	ctx: MerchantDocumentsActionCtx,
	document: Doc<"merchantDocuments">,
) {
	await ctx.runMutation(internal.merchantDocuments.markDocumentProcessing, {
		documentId: document._id,
	});

	try {
		const { data, mimeType } = await fetchDocumentBytes(document);
		const format = detectDocumentFormat({
			fileName: document.fileName,
			mimeType,
		});

		if (!format) {
			throw new Error("Unsupported document format. Use PDF, TXT, Markdown, DOCX, or CSV.");
		}

		const extracted = await extractDocumentText({
			data,
			format,
		});

		if (extracted.length < 24) {
			throw new Error("No useful extractable text was found in this document.");
		}

		const preparedChunks = chunkDocumentText(extracted);

		if (preparedChunks.length === 0) {
			throw new Error("The parsed document did not produce any retrievable text chunks.");
		}

		const embeddingModel = getEmbeddingModel();

		if (!embeddingModel) {
			throw new Error(
				"Missing `CONVEX_OPENAI_API_KEY` (or `OPENAI_API_KEY`) for document embeddings.",
			);
		}

		const { embeddings } = await embedMany({
			model: embeddingModel,
			values: preparedChunks.map((chunk) => chunk.text),
		});

		if (embeddings.length !== preparedChunks.length) {
			throw new Error("Embedding generation did not return a vector for every text chunk.");
		}

		await ctx.runMutation(internal.merchantDocuments.clearDocumentChunks, {
			documentId: document._id,
		});

		for (let index = 0; index < preparedChunks.length; index += 8) {
			const batch = preparedChunks.slice(index, index + 8);
			await ctx.runMutation(internal.merchantDocuments.insertDocumentChunkBatch, {
				chunks: batch.map((chunk, batchIndex) => ({
					chunkNumber: chunk.chunkNumber,
					charEnd: chunk.charEnd,
					charStart: chunk.charStart,
					embedding: embeddings[index + batchIndex] ?? [],
					embeddingModel: DOCUMENT_EMBEDDING_MODEL,
					fileName: document.fileName ?? undefined,
					searchText: chunk.text,
					snippet: chunk.snippet,
					text: chunk.text,
					title: document.title,
					visibility: document.visibility,
				})),
				documentId: document._id,
				shopId: document.shopId,
			});
		}

		const storedContent = truncateStoredDocumentContent(extracted);
		await ctx.runMutation(internal.merchantDocuments.markDocumentReady, {
			content: storedContent.content,
			contentPreview: previewText(extracted),
			contentTruncated: storedContent.truncated,
			documentId: document._id,
			parsedCharacterCount: extracted.length,
			searchText: searchTextForDocument({
				content: extracted,
				fileName: document.fileName,
				title: document.title,
			}),
			summary: summarizeDocument(extracted),
		});

		return {
			documentId: document._id,
			error: null,
			title: document.title,
		};
	} catch (error) {
		const reason = error instanceof Error ? error.message : "Document parsing failed unexpectedly.";
		await ctx.runMutation(internal.merchantDocuments.markDocumentFailed, {
			documentId: document._id,
			reason,
		});

		return {
			documentId: document._id,
			error: reason,
			title: document.title,
		};
	}
}

async function lexicalChunkMatches(
	ctx: MerchantDocumentsActionCtx,
	args: {
		limit: number;
		query: string;
		shopId: Id<"shops">;
		visibility: KnowledgeDocumentVisibility;
	},
) {
	return await ctx.runQuery(internal.merchantDocuments.searchKnowledgeChunksByText, args);
}

export const processQueuedDocuments = internalAction({
	args: {
		jobId: v.id("syncJobs"),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const documents = await ctx.runQuery(internal.merchantDocuments.listProcessingDocuments, {
			shopId: args.shopId,
		});

		if (documents.length === 0) {
			await ctx.runMutation(internal.merchantDocuments.appendWorkflowLog, {
				jobId: args.jobId,
				level: "info",
				message: "No documents were queued for processing.",
				shopId: args.shopId,
			});

			return {
				failedCount: 0,
				processedCount: 0,
			};
		}

		let processedCount = 0;
		let failedCount = 0;

		for (const document of documents) {
			const result = await processDocument(ctx, document);

			if (result.error) {
				failedCount += 1;
				await ctx.runMutation(internal.merchantDocuments.appendWorkflowLog, {
					detail: result.error,
					jobId: args.jobId,
					level: "error",
					message: `Failed to process ${result.title}.`,
					shopId: args.shopId,
				});
			} else {
				processedCount += 1;
				await ctx.runMutation(internal.merchantDocuments.appendWorkflowLog, {
					jobId: args.jobId,
					level: "success",
					message: `Processed ${result.title}.`,
					shopId: args.shopId,
				});
			}
		}

		return {
			failedCount,
			processedCount,
		};
	},
});

export const retrieveKnowledge = internalAction({
	args: {
		audience: v.union(v.literal("merchant"), v.literal("storefront")),
		limit: v.optional(v.number()),
		query: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args): Promise<KnowledgeMatch[]> => {
		const queryText = normalizeDocumentText(args.query).slice(0, 500);
		const limit = Math.min(Math.max(args.limit ?? 6, 1), 10);

		if (queryText.length < 2) {
			return [];
		}

		const [publicLexical, privateLexical] = await Promise.all([
			lexicalChunkMatches(ctx, {
				limit,
				query: queryText,
				shopId: args.shopId,
				visibility: "public",
			}),
			args.audience === "merchant"
				? lexicalChunkMatches(ctx, {
						limit,
						query: queryText,
						shopId: args.shopId,
						visibility: "shop_private",
					})
				: Promise.resolve([]),
		]);

		const orderedChunkIds: Id<"merchantDocumentChunks">[] = [];
		const seenChunkIds = new Set<Id<"merchantDocumentChunks">>();

		for (const row of [...publicLexical, ...privateLexical]) {
			if (!seenChunkIds.has(row._id)) {
				seenChunkIds.add(row._id);
				orderedChunkIds.push(row._id);
			}
		}

		const embeddingModel = getEmbeddingModel();

		if (embeddingModel) {
			try {
				const { embedding } = await embed({
					model: embeddingModel,
					value: queryText,
				});
				const scopeKeys =
					args.audience === "merchant"
						? [`${args.shopId}:public`, `${args.shopId}:shop_private`]
						: [`${args.shopId}:public`];
				const vectorMatches = await ctx.vectorSearch("merchantDocumentChunks", "by_embedding", {
					filter: (query) =>
						scopeKeys.length > 1
							? query.or(query.eq("scopeKey", scopeKeys[0]), query.eq("scopeKey", scopeKeys[1]))
							: query.eq("scopeKey", scopeKeys[0]),
					limit,
					vector: embedding,
				});

				for (const match of vectorMatches) {
					if (!seenChunkIds.has(match._id)) {
						seenChunkIds.add(match._id);
						orderedChunkIds.push(match._id);
					}
				}
			} catch {
				// Fall back to lexical retrieval when embedding lookup fails.
			}
		}

		if (orderedChunkIds.length === 0) {
			return [];
		}

		const hydrated: HydratedKnowledgeChunk[] = await ctx.runQuery(
			internal.merchantDocuments.hydrateKnowledgeChunks,
			{
				chunkIds: orderedChunkIds,
			},
		);

		return hydrated
			.filter((row): row is ReadyHydratedKnowledgeChunk => {
				const document = row.document;
				return document !== null && document.status === "ready" && document.shopId === args.shopId;
			})
			.slice(0, limit)
			.map((row) => ({
				chunkId: row.chunkId,
				chunkNumber: row.chunkNumber,
				citation: buildDocumentCitation({
					chunkNumber: row.chunkNumber,
					snippet: row.snippet,
					title: row.document.title,
				}),
				documentId: row.documentId,
				snippet: row.snippet,
				text: row.text,
				title: row.document.title,
				visibility: row.visibility,
			}));
	},
});
