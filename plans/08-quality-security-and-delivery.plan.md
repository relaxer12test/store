# Quality, Security, And Delivery

## Context
The take-home will be judged on end-to-end thinking, not just code generation. The implementation needs a clear test strategy, observability, deployment plan, and submission-ready polish.

## Objective
Define the verification, deployment, auditability, and submission standards for the finished project.

## Test Strategy
- Add backend tests for shop-context auth helpers, selective sync transforms, AI tool guards, and approval flows.
- Add integration tests for the first embedded bootstrap/token exchange flow, config-managed webhook ingestion, cache/index refreshes, and app embed activation paths where practical.
- Add UI tests for embedded app boot, storefront widget safety refusals, and approval-card execution.
- Add schema validation tests for `CartPlan` and `DashboardSpec`.
- Add regression tests for “no free item” and “no hidden discount” public AI cases.

## Security Checklist
- Verify every Convex endpoint resolves the active shop before touching protected data.
- Verify embedded admin endpoints require a valid Shopify session token or equivalent verified shop context.
- Verify public AI endpoints can read only storefront-safe catalog data and `public` documents.
- Verify merchant write actions require explicit approval before Shopify mutations run.
- Verify uninstall blocks future sync and action execution for the removed shop.
- Verify any `/internal` or equivalent dev console is disabled or strongly gated outside explicit development/staff environments.
- Keep Shopify offline tokens, OpenAI keys, Cloudflare credentials, and any private storefront tokens only in server-side environment configuration.
- Verify embedded HTML responses send dynamic `Content-Security-Policy` `frame-ancestors` values for the active shop admin domain and Shopify admin.

## Observability
- Log install events, sync jobs, webhook deliveries, AI tool calls, refusal reasons, approvals, action results, and document processing state in Convex tables.
- Expose merchant-friendly diagnostics in the embedded settings/workflow views.
- Add clear status indicators for stale cache data, failed webhooks, failed workflows, and failed document parsing.

## Deployment Requirements
- Deploy TanStack Start to Cloudflare Workers at `storeai.ldev.cloud`.
- Keep `store.ldev.cloud` and `storedev.ldev.cloud` pointed at Shopify Online Store.
- Serve the embedded app over HTTPS and load the latest Shopify App Bridge on embedded HTML documents.
- Preserve and use Shopify's `host` parameter correctly for embedded app boot and navigation.
- Serve Convex on a custom domain suitable for webhook, AI, document, and merchant-protected backend endpoints.
- Keep app and Convex domains coherent enough for embedded app communication, webhook configuration, and storefront widget communication.
- Document dev, preview, and production environment variables clearly.

## Demo Readiness
- Seed the dev store with enough products, variants, collections, and orders to make the dashboard and AI interactions convincing.
- Prepare at least one public policy document and one merchant-private document.
- Ensure the theme app embed is enabled in the demo store.
- Ensure at least one merchant AI approved write path is demonstrated safely.
- Ensure the embedded settings area contains useful diagnostics without relying on a separate ops console.

## Submission Deliverables
- A README that explains architecture, setup, tradeoffs, and demo flow.
- A short demo script that walks through install, storefront AI, embedded merchant overview, merchant AI action approval, document grounding, and diagnostics.
- A small “known limitations” section that honestly lists any deferred areas without undermining the main architecture.

## Execution Order
- Complete plans `00` through `03` before implementing either AI surface.
- Implement `05` and `06` against direct Shopify queries plus minimal Convex state first.
- Add `04` selectively wherever repeated queries, AI retrieval, or dashboard latency justify a Convex cache or index.
- Complete `07` after the core AI surfaces exist but before final polish.
- Complete this plan’s testing, diagnostics, and delivery work before considering the project done.

## Acceptance Criteria
- The app is deployable, inspectable, and demoable without manual hand-waving.
- The most security-sensitive flows have explicit tests and audit trails.
- The final submission reads like a product built by an engineer who understands Shopify integration, not just prompts.
