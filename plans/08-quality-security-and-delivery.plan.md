# Quality, Security, And Delivery

## Context
The take-home will be judged on end-to-end thinking, not just code generation. The implementation needs a clear test strategy, observability, deployment plan, and submission-ready polish.

## Objective
Define the verification, deployment, auditability, and submission standards for the finished project.

## Test Strategy
- Add backend tests for auth helpers, tenant isolation, sync transforms, AI tool guards, and approval flows.
- Add integration tests for Shopify install lifecycle, webhook ingestion, and warehouse projection updates.
- Add UI tests for protected app load, storefront widget safety refusals, and approval-card execution.
- Add schema validation tests for `CartPlan` and `DashboardSpec`.
- Add regression tests for “no free item” and “no hidden discount” public AI cases.

## Security Checklist
- Verify every Convex endpoint resolves viewer and tenant before touching protected data.
- Verify public AI endpoints can only read public projections and public documents.
- Verify merchant write actions require explicit approval before Shopify mutations run.
- Verify uninstall blocks future sync and action execution for the removed shop.
- Verify logs and audit tables do not leak secrets or raw tokens.
- Keep Shopify offline tokens, Better Auth secrets, OpenAI keys, and Cloudflare credentials only in server-side environment configuration.

## Observability
- Log sync jobs, webhook deliveries, AI tool calls, refusal reasons, approvals, action results, and document processing state in Convex tables.
- Expose tenant-friendly diagnostics in settings.
- Expose richer cross-tenant diagnostics in `/ops`.
- Add clear status indicators for stale sync, failed webhooks, failed workflows, and failed document parsing.

## Deployment Requirements
- Deploy TanStack Start to Cloudflare Workers.
- Serve Convex on a custom domain suitable for Better Auth and Shopify callback/webhook endpoints.
- Configure production cookie settings for embedded use.
- Keep marketing, app, and Convex endpoint domains coherent enough for session and iframe behavior.
- Document dev, preview, and production environment variables clearly.

## Demo Readiness
- Seed the dev store with enough products, variants, collections, customers, and orders to make the dashboard and AI interactions convincing.
- Prepare at least one public policy document and one private merchant document.
- Ensure the theme app embed is enabled in the demo store.
- Ensure at least one merchant AI approved write path is demonstrated safely.
- Ensure `/ops` contains useful but concise diagnostics.

## Submission Deliverables
- A README that explains architecture, setup, tradeoffs, and demo flow.
- A short demo script that walks through install, storefront AI, merchant overview, merchant AI action approval, document grounding, and ops diagnostics.
- A small “known limitations” section that honestly lists any deferred areas without undermining the main architecture.

## Execution Order
- Complete plans `00` through `04` before implementing either AI surface.
- Complete `05` and `06` after the warehouse and auth layers are stable.
- Complete `07` after the core AI surfaces exist but before final polish.
- Complete this plan’s testing, diagnostics, and delivery work before considering the project done.

## Acceptance Criteria
- The app is deployable, inspectable, and demoable without manual hand-waving.
- The most security-sensitive flows have explicit tests and audit trails.
- The final submission reads like a product built by an engineer who understands systems, not just prompts.
