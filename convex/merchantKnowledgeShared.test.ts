import { describe, expect, it } from "vitest";
import {
	chunkDocumentText,
	detectDocumentFormat,
	normalizeMarkdownText,
	truncateStoredDocumentContent,
} from "./merchantKnowledgeShared";

describe("merchantKnowledgeShared", () => {
	it("detects csv before the generic text mime branch", () => {
		expect(
			detectDocumentFormat({
				fileName: "inventory-export.txt",
				mimeType: "text/csv",
			}),
		).toBe("csv");
	});

	it("falls back to the file extension when mime type is absent", () => {
		expect(
			detectDocumentFormat({
				fileName: "returns-policy.docx",
			}),
		).toBe("docx");
	});

	it("normalizes markdown into plain searchable text", () => {
		expect(
			normalizeMarkdownText(`
# Returns Policy

- Items can be returned within **30 days**.
- Email [support](mailto:support@example.com).
			`),
		).toBe("Returns Policy\nItems can be returned within **30 days**.\nEmail support.");
	});

	it("chunks long documents deterministically", () => {
		const sentence = "Orders over $50 ship free. ";
		const longDocument = sentence.repeat(120);
		const chunks = chunkDocumentText(longDocument);

		expect(chunks.length).toBeGreaterThan(1);
		expect(chunks[0]?.chunkNumber).toBe(1);
		expect(chunks[1]?.chunkNumber).toBe(2);
		expect(chunks[0]?.charStart).toBe(0);
		expect(chunks[1]?.charStart).toBeLessThan(chunks[0]?.charEnd ?? 0);
	});

	it("truncates stored content when the extracted text is too large", () => {
		const oversized = "A".repeat(220_000);
		const truncated = truncateStoredDocumentContent(oversized);

		expect(truncated.truncated).toBe(true);
		expect(truncated.content).toHaveLength(200_000);
	});
});
