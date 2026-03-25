# Global Contract

## Project Summary
Build a production-grade Shopify app for a single store with two connected product surfaces:
- A real Shopify storefront on `store.ldev.cloud` and `storedev.ldev.cloud` with a shopper-facing AI concierge injected as a theme app embed.
- An embedded Shopify admin app hosted from `storeai.ldev.cloud` for merchant setup, diagnostics, documents, dashboards, and merchant AI workflows.

TanStack Start runs on Cloudflare Workers at `storeai.ldev.cloud`. Convex owns the backend behavior that matters: AI orchestration, document ingestion, audit logging, selective Shopify caching/indexing, and Shopify-facing HTTP endpoints.

## Locked Technology Decisions
- Use the official TanStack Start starter as the application shell.
- Host the TanStack Start worker app on `storeai.ldev.cloud`.
- Leave `store.ldev.cloud` and `storedev.ldev.cloud` on Shopify Online Store, not on Workers.
- Use Convex as the real backend for app logic, AI tools, shop-scoped data, webhooks, workflows, and audits.
- Use Shopify’s embedded app model with App Bridge, session tokens, token exchange, and managed installation where possible.
- Use GraphQL Admin API for merchant reads/writes from the backend.
- Use Storefront API or storefront-safe cart APIs for shopper-facing catalog/cart flows.
- Use a Shopify theme app extension or app embed for the storefront widget.
- Use Cloudflare R2 via `@convex-dev/r2` for document/file blobs.
- Use Tailwind CSS, Tailwind Plus patterns, and Catalyst wrappers for UI.
- Do not build multi-tenancy or a cross-tenant platform-admin surface in v1.

## Backend Boundary
- Shopify owns storefront rendering, product pages, theme layout, and checkout.
- Workers own TanStack Start delivery on `storeai.ldev.cloud`, public shell/install screens, and embedded app assets.
- Convex owns backend endpoints that matter, including Shopify install/auth support, webhook ingress, AI chat endpoints, document ingestion, audit logs, and selective cache/sync jobs.
- Workers must not own business rules, approval policy, AI orchestration, or durable data writes.

## Product Surfaces
- `store.ldev.cloud` and `storedev.ldev.cloud` are Shopify storefront domains.
- `https://storeai.ldev.cloud/` is the public app shell for install/help/demo entry.
- `https://storeai.ldev.cloud/app` is the embedded Shopify admin surface.
- `https://storeai.ldev.cloud/internal` may exist as a dev-only debug/admin console for our own diagnostics and workflow support while building.
- The storefront AI lives inside a Shopify theme app extension or app embed, not inside the app landing page.
- There is no `/ops` surface in v1.

The internal console is not a merchant product surface and must be hidden behind explicit development/staff-only access controls.

## UX Non-Negotiables
- The embedded app must feel like a smooth SPA inside Shopify admin.
- Avoid full-page redirects and auth flicker inside the embedded app.
- Do not depend on cookie-based SSR auth for embedded routes.
- Keep previous content visible during client transitions instead of blanking the page.
- TanStack Form usage must stay behind composable wrappers such as `MainForm`, `FormSection`, and `FormTextField`.
- Do not scatter raw form hooks through feature components.

## Security Non-Negotiables
- Public AI must never call Shopify Admin APIs.
- Public AI must never create discounts, make items free, alter price, or reveal hidden inventory.
- Merchant AI may write only through explicit tool approval and full audit logging.
- Embedded admin requests must be authenticated with Shopify session tokens.
- Shopper-facing AI and merchant-facing AI must use different prompts, tools, rate limits, and data scopes.
- Convex must treat Shopify as the canonical source of merchant state even when it keeps selective caches or indexes.

## Success Criteria
- The app installs on a Shopify dev store and works as an embedded admin app.
- The storefront AI widget works on the live store theme through an app embed.
- Merchant-facing setup and diagnostics run from `storeai.ldev.cloud`.
- Convex stores only the indexed or cached Shopify data the app actually needs for AI, diagnostics, and repeated reads.
- Merchant AI can answer questions and perform approved admin actions.
- Shopper AI can answer catalog questions and assist cart building safely.
- The final repo demonstrates strong architecture, clean composition, and a correct Shopify integration model.

## Explicit Non-Goals For V1
- No multi-tenant architecture.
- No separate platform-admin control plane.
- No automatic discounts, refunds, order cancellations, or fulfillment actions.
- No shopper account support, order lookup, or post-purchase support flows.
- No full headless storefront replacement.
- No backend logic implemented directly in Workers or theme code.

## Required Stretch Features
- Generative merchant dashboards.
- Document upload, parsing, and retrieval grounding.
- Convex-backed workflows and async jobs.

## Acceptance Standard
A fresh implementation agent should be able to execute any later plan file while treating this document as the top-level contract.
