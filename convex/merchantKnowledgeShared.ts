import type { MerchantCitation } from "../src/shared/contracts/merchant-workspace";

export type KnowledgeDocumentVisibility = "public" | "shop_private";

export const DOCUMENT_PREVIEW_LIMIT = 320;
export const DOCUMENT_SUMMARY_LIMIT = 220;
export const DOCUMENT_CHUNK_PREVIEW_LIMIT = 220;
export const DOCUMENT_CHUNK_TARGET_CHARS = 1_200;
export const DOCUMENT_CHUNK_MIN_CHARS = 600;
export const DOCUMENT_CHUNK_OVERLAP_CHARS = 180;
export const MAX_DOCUMENT_CHUNKS = 128;
export const MAX_INLINE_DOCUMENT_CHARS = 120_000;
export const MAX_DOCUMENT_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_STORED_DOCUMENT_CONTENT_CHARS = 200_000;

export const DOCUMENT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DOCUMENT_EMBEDDING_DIMENSIONS = 1_536;

const DOCUMENT_EXTENSION_FORMATS = new Map<string, ExtractedDocumentFormat>([
	["csv", "csv"],
	["docx", "docx"],
	["markdown", "markdown"],
	["md", "markdown"],
	["pdf", "pdf"],
	["text", "text"],
	["txt", "text"],
]);

export type ExtractedDocumentFormat = "csv" | "docx" | "markdown" | "pdf" | "text";

export interface PreparedKnowledgeChunk {
	chunkNumber: number;
	charEnd: number;
	charStart: number;
	searchText: string;
	snippet: string;
	text: string;
}

function extensionForFileName(fileName: string | undefined) {
	if (!fileName) {
		return null;
	}

	const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
	return match?.[1] ?? null;
}

export function detectDocumentFormat(args: {
	fileName?: string | null;
	mimeType?: string | null;
}): ExtractedDocumentFormat | null {
	const mimeType = args.mimeType?.toLowerCase().trim();

	if (mimeType === "application/pdf") {
		return "pdf";
	}

	if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
		return "docx";
	}

	if (mimeType === "text/markdown" || mimeType === "text/x-markdown") {
		return "markdown";
	}

	if (mimeType === "text/csv" || mimeType === "application/csv") {
		return "csv";
	}

	if (mimeType === "text/plain" || mimeType?.startsWith("text/")) {
		return "text";
	}

	const extension = extensionForFileName(args.fileName ?? undefined);

	if (!extension) {
		return null;
	}

	return DOCUMENT_EXTENSION_FORMATS.get(extension) ?? null;
}

export function isSupportedDocumentUpload(args: {
	fileName?: string | null;
	mimeType?: string | null;
}) {
	return detectDocumentFormat(args) !== null;
}

export function normalizeDocumentTitle(value: string) {
	return value.trim().replace(/\s+/g, " ");
}

export function normalizeDocumentText(value: string) {
	const withoutFrontMatter = value.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");

	return withoutFrontMatter
		.replace(/\r\n?/g, "\n")
		.replaceAll("\0", "")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/[^\S\n]{2,}/g, " ")
		.trim();
}

export function normalizeMarkdownText(value: string) {
	return normalizeDocumentText(
		value
			.replace(/^#{1,6}\s+/gm, "")
			.replace(/!\[[^\]]*]\([^)]+\)/g, " ")
			.replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1")
			.replace(/`{1,3}/g, "")
			.replace(/^>\s?/gm, "")
			.replace(/^[-*_]{3,}$/gm, "")
			.replace(/^\s*[-*+]\s+/gm, "")
			.replace(/^\s*\d+\.\s+/gm, ""),
	);
}

export function previewText(value: string, limit = DOCUMENT_PREVIEW_LIMIT) {
	const normalized = normalizeDocumentText(value);

	if (normalized.length <= limit) {
		return normalized;
	}

	return `${normalized.slice(0, limit).trimEnd()}…`;
}

export function summarizeDocument(value: string) {
	const normalized = normalizeDocumentText(value);

	if (normalized.length <= DOCUMENT_SUMMARY_LIMIT) {
		return normalized;
	}

	const sentences = normalized
		.split(/(?<=[.!?])\s+/)
		.slice(0, 2)
		.join(" ");

	if (sentences.length >= 48) {
		return sentences.slice(0, DOCUMENT_SUMMARY_LIMIT).trimEnd();
	}

	return normalized.slice(0, DOCUMENT_SUMMARY_LIMIT).trimEnd();
}

export function truncateStoredDocumentContent(value: string) {
	if (value.length <= MAX_STORED_DOCUMENT_CONTENT_CHARS) {
		return {
			content: value,
			truncated: false,
		};
	}

	return {
		content: value.slice(0, MAX_STORED_DOCUMENT_CONTENT_CHARS),
		truncated: true,
	};
}

export function searchTextForDocument(args: {
	content: string;
	fileName?: string | null;
	title: string;
}) {
	return [args.title, args.fileName, args.content].filter(Boolean).join(" ");
}

export function searchTextForChunk(args: {
	fileName?: string | null;
	text: string;
	title: string;
}) {
	return [args.title, args.fileName, args.text].filter(Boolean).join(" ");
}

function findChunkBoundary(text: string, start: number, tentativeEnd: number) {
	if (tentativeEnd >= text.length) {
		return text.length;
	}

	const lowerBound = Math.min(text.length, start + DOCUMENT_CHUNK_MIN_CHARS);
	const tail = text.slice(lowerBound, tentativeEnd + 1);
	const boundaryMatch = [...tail.matchAll(/(\n\n|[.!?]\s+)/g)].pop();

	if (!boundaryMatch || boundaryMatch.index === undefined) {
		return tentativeEnd;
	}

	return lowerBound + boundaryMatch.index + boundaryMatch[0].length;
}

export function chunkDocumentText(value: string) {
	const normalized = normalizeDocumentText(value);

	if (normalized.length === 0) {
		return [];
	}

	const chunks: PreparedKnowledgeChunk[] = [];
	let cursor = 0;
	let chunkNumber = 1;

	while (cursor < normalized.length && chunkNumber <= MAX_DOCUMENT_CHUNKS) {
		const tentativeEnd = Math.min(normalized.length, cursor + DOCUMENT_CHUNK_TARGET_CHARS);
		const end = findChunkBoundary(normalized, cursor, tentativeEnd);
		const text = normalized.slice(cursor, end).trim();

		if (text.length === 0) {
			break;
		}

		chunks.push({
			chunkNumber,
			charEnd: end,
			charStart: cursor,
			searchText: text,
			snippet: previewText(text, DOCUMENT_CHUNK_PREVIEW_LIMIT),
			text,
		});
		chunkNumber += 1;

		if (end >= normalized.length) {
			break;
		}

		let nextCursor = Math.max(end - DOCUMENT_CHUNK_OVERLAP_CHARS, cursor + 1);

		while (nextCursor < normalized.length && /\s/.test(normalized[nextCursor] ?? "")) {
			nextCursor += 1;
		}

		cursor = nextCursor;
	}

	return chunks;
}

export function buildDocumentCitation(args: {
	chunkNumber: number;
	snippet: string;
	title: string;
}): MerchantCitation {
	return {
		detail: `Excerpt ${args.chunkNumber}: ${args.snippet}`,
		href: null,
		label: args.title,
		sourceType: "document",
	};
}
