# Documents, R2, And Knowledge

## Context
The take-home explicitly invites document parsing. This feature must support both merchant-facing AI grounding and storefront-safe public knowledge without mixing private and public corpora.

## Objective
Build a document ingestion pipeline using R2 for blobs and Convex for metadata, parsing, chunking, embeddings, retrieval, and visibility control.

## Storage Strategy
- Store raw files in Cloudflare R2 using `@convex-dev/r2`.
- Store document metadata, processing state, chunks, embeddings, citations, and visibility in Convex.
- Keep tenant ownership and visibility on every document record.

## Supported Document Classes
- Public policy and FAQ documents for storefront AI.
- Private merchant documents such as SOPs, playbooks, and notes for merchant AI.
- Optional CSV attachments for future analytics workflows, but do not make CSV import a v1 dependency unless implementation time remains.

## Visibility Model
- `public` documents may be used by storefront AI and merchant AI.
- `tenant_private` documents may be used only by merchant AI inside the owning tenant.
- Platform-admin-only documents are optional and should stay out of v1 unless needed for ops.

## Processing Pipeline
- Upload file metadata and blob.
- Enqueue a Convex workflow for parsing.
- Extract text from supported formats.
- Chunk text deterministically.
- Generate embeddings.
- Persist chunks and embeddings in Convex.
- Mark document status as ready or failed with a reason.

## Retrieval Rules
- Storefront AI may retrieve only `public` documents for the active shop.
- Merchant AI may retrieve `public` plus `tenant_private` documents for the active tenant.
- Retrieval results should include citation payloads so the UI can show source references.
- Retrieval must never silently cross tenant boundaries.

## Parsing Requirements
- Prioritize reliable formats first: PDF, TXT, Markdown, and DOCX if feasible.
- If OCR is needed for image-heavy PDFs, keep it as a post-v1 enhancement unless implementation remains clean.
- Normalize extracted text before chunking to improve retrieval quality.

## UX Requirements
- Merchant settings must support upload, delete, visibility assignment, status inspection, and reprocess.
- AI answers that rely on documents should show citations and distinguish document-grounded claims from warehouse-grounded claims.
- Public store policies should be manageable without forcing a redeploy or theme change.

## Acceptance Criteria
- A merchant can upload a document, watch it process, and use it in the merchant AI.
- A merchant can mark a document public and see the storefront AI use it for policy answers.
- Retrieval never leaks private documents into public AI responses.
- Failed parses are visible and retryable.
