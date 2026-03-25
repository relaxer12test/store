# Shopify Access, Cache, And Sync

## Context
V1 no longer needs a blanket warehouse-style mirror of Shopify. We should query Shopify directly when the access pattern is low-volume or one-off, and keep only the shop-scoped Convex indexes and caches that materially improve AI latency, diagnostics, or repeated reads.

## Objective
Define a hybrid access model that combines direct Shopify API access with selective Convex caching, indexing, and sync jobs.

## Core Access Model
- Use Shopify Admin API for merchant-facing reads, writes, and diagnostics that are low-volume or point-in-time.
- Use Storefront API or storefront-safe cart APIs for shopper-facing catalog and cart flows.
- Use Convex for AI orchestration, public/private document retrieval, action audits, diagnostics, and only the cached Shopify data the app repeatedly needs.
- Do not treat Convex as a full commerce warehouse by default in v1.

## Data Domains To Persist In Convex
- Shop installation metadata and status
- Widget settings and public AI controls
- Webhook deliveries
- Sync jobs and cache refresh jobs
- Action audit records
- AI traces and refusal logs
- Document metadata, chunks, embeddings, and citations
- Optional public catalog index or merchant metrics cache if direct Shopify queries prove too slow or expensive

## When To Query Shopify Directly
- Merchant point lookups and drill-ins
- Approved mutations
- Install health checks and scope checks
- Lightweight merchant dashboard reads while the app is still small
- Storefront canonical cart state

## When To Cache Or Index In Convex
- Repeated AI retrieval and product search
- Structured dashboard cards reused across sessions
- Fast autocomplete, filtering, or recommendation retrieval
- Public policy and knowledge grounding joined with Shopify entities
- Diagnostics that should remain visible even when Shopify is temporarily slow

## Sync Strategy
- Start with no mandatory full historical backfill.
- If the app introduces a public catalog index or metrics cache, seed it with targeted Admin API queries first.
- Use Shopify Bulk Operations only when the cached/indexed scope becomes large enough that normal pagination is wasteful.
- After any cache/index is introduced, use webhooks for incremental freshness.
- Prefer app-specific, config-managed webhook subscriptions from `shopify.app.toml`. Use shop-specific webhook subscriptions only when the topic, filter, or destination truly differs by shop.
- Add periodic reconciliation jobs only for the cached data the app actually depends on.

## Required Sync Jobs
- Catalog index rebuild
- Metrics cache refresh
- Reconciliation scan
- Shop uninstall cleanup
- Optional bulk import jobs if the cached surface grows

## Data Modeling Rules
- Store Shopify IDs in dedicated indexed fields, not only inside blobs.
- Separate raw webhook payloads from derived summary records.
- Track source timestamps and last refreshed timestamps per cached entity.
- Keep any public catalog projection explicitly sanitized for shopper AI use.

## Idempotency Rules
- Every webhook delivery must be keyed by topic plus shop plus Shopify event identity if available.
- Reprocessing the same delivery must be safe.
- Cache rebuilds must be deterministic from the current source data.
- Optional bulk imports must upsert records by stable Shopify identifiers.

## Query Layer Requirements
- Build explicit Convex queries for:
  - install and webhook health
  - widget configuration
  - public catalog search if a public index exists
  - merchant dashboard cards if a metrics cache exists
  - action audits, AI traces, and workflow status
- Do not make the frontend compute important analytics ad hoc.

## Operational Diagnostics
- Expose last webhook time, last successful cache refresh, failed deliveries, pending jobs, and stale-cache warnings.
- Make these visible in `/app/settings` and workflow/diagnostic views inside the embedded app.

## Acceptance Criteria
- The storefront AI and embedded merchant app work without requiring a full warehouse mirror.
- Repeated high-value queries can be served from Convex cache or indexes when enabled.
- Incremental webhooks update cached records without duplicates.
- Approved writes still execute against Shopify as the canonical system of record.
