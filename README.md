# Growth Capital Shopify AI

Embedded Shopify app and storefront AI assistant built with TanStack Start, Convex, Cloudflare Workers, and a Shopify theme app embed.

## Architecture

- `src/`: TanStack Start app shell, embedded admin routes, merchant UI, internal diagnostics, and API proxy routes.
- `convex/`: shop auth/bootstrap, webhook ingestion, sync/cache workflows, merchant copilot flows, document processing, and storefront AI runtime.
- `extensions/storefront-ai/`: theme app embed that mounts the shopper-facing assistant on the Online Store.
- `theme/`: custom Shopify theme source that is pushed directly to the live theme.
- `wrangler.jsonc`: Cloudflare Workers deployment for `storeai.ldev.cloud`.
- `shopify.app.toml`: embedded Shopify app config and webhook subscriptions.

### Runtime shape

- `storeai.ldev.cloud`: embedded admin app and public widget proxy.
- `store.ldev.cloud` and `storedev.ldev.cloud`: Shopify Online Store domains that keep serving the storefront.
- Convex: system of record for audit logs, sync jobs, cache states, widget config, merchant documents, approvals, and AI event traces.
- Shopify: source of truth for products, orders, inventory, themes, and merchant mutations.

## Main flows

### Embedded admin bootstrap

1. Shopify admin loads the embedded app.
2. App Bridge provides a session token.
3. `/api/shopify/bootstrap` verifies the token in Convex, persists the shop + merchant actor, then completes a Better Auth merchant bridge on an HTTP cookie-capable path.
4. Better Auth establishes the browser session, issues the Convex JWT cookie, and the first merchant-authenticated user is promoted to native `admin`.

### Webhooks and cache refresh

1. Shopify sends webhooks to `/api/shopify/webhooks`.
2. TanStack Start forwards the validated headers/body to Convex HTTP.
3. Convex validates the webhook, stores delivery/audit rows, and queues only the relevant follow-up jobs:
   `catalog_index_rebuild`, `metrics_cache_refresh`, `reconciliation_scan`, or `shop_uninstall_cleanup`.

### Storefront AI

- The theme app embed fetches widget config through `/api/shopify/widget`.
- Chat requests stream through `/api/shopify/widget/chat`.
- The storefront runtime refuses discount, private-data, and restricted-action prompts before model generation.
- Replies are grounded only in public catalog data and storefront-safe policy content.

### Merchant copilot

- Merchant reads use the embedded Convex JWT and shop-scoped claims.
- Write intents become approval cards first.
- Only explicit approval runs Shopify mutations.
- Approval outcomes, webhook deliveries, sync jobs, and document processing all land in audit-oriented Convex tables.

### Internal admin

- Internal access is native Better Auth `admin` only.
- The first merchant-authenticated Better Auth user is promoted automatically so internal user management can proceed from the app.
- `/internal/users` uses Better Auth admin APIs to manage native roles from there on.

## Development

Install dependencies and run the app:

```bash
npm install
npm run dev
```

Optional Vite+ workflow:

```bash
vp install
vp dev --port 3000
```

Useful commands:

```bash
npm test
npm run check
npm run lint
npm run format
npm run convex:dev
```

## Environment

### Client / TanStack Start

- `VITE_CONVEX_URL`: Convex deployment URL used by the app shell, Convex query client, and embedded merchant token flow.
- `VITE_CONVEX_SITE_URL`: optional Convex HTTP/site URL override used by server-side proxy routes for Convex HTTP actions. If omitted, the app derives it from `VITE_CONVEX_URL`.
- `VITE_SHOPIFY_API_KEY`: Shopify app key exposed to embedded HTML for App Bridge boot.

### Convex / server-only

- `SHOPIFY_APP_URL`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_SECRET`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_JWKS` (optional static JWKS cache for Better Auth Convex tokens)
- `RESEND_API_KEY` (required to actually deliver password reset emails)
- `RESEND_FROM_EMAIL` (required to send password reset emails)
- `RESEND_FROM_NAME` (optional, defaults to `StoreAI`)
- `RESEND_WEBHOOK_SECRET` (optional until you configure the webhook below)
- `CONVEX_OPENAI_API_KEY` or `OPENAI_API_KEY`
- `CONVEX_STOREFRONT_CONCIERGE_MODEL` (optional override)

### Cloudflare

- `STORE_R2` Wrangler binding for the Workers app.
- Convex R2 component credentials/config are managed in Convex, not in this repo.

## Deployment

Production deploy target:

- TanStack Start on Cloudflare Workers at `storeai.ldev.cloud`
- Shopify app config with `application_url = "https://storeai.ldev.cloud"`
- Convex custom domain for bootstrap, webhook, widget, document, and merchant-protected backend traffic
- Resend webhook at `<your CONVEX_SITE_URL>/resend-webhook` once you add the webhook in Resend

Deploy commands:

```bash
npm run deploy
```

That runs the app build, pushes Convex to the configured deployment with
`convex dev --once`, deploys the Worker with Wrangler, publishes the
Shopify app configuration plus theme app extension with
`shopify app deploy --force`, and then pushes the custom `/theme` directory to the live theme with
`shopify theme push --path theme --live --allow-live`.

If you only need to push the Worker runtime without releasing a Shopify app version,
use:

```bash
npm run deploy:runtime
```

If you only need to push the custom Shopify theme, use:

```bash
npm run theme:deploy
```

After `shopify app deploy`, open the embedded app in Shopify admin, go to
`/app/settings`, use the `Open theme editor` action in the `Storefront embed status`
panel, enable the `storefront-ai` app embed on the live theme, and save the theme.

## Quality and security posture

- Embedded HTML now sets a dynamic `Content-Security-Policy` `frame-ancestors` value using the active Shopify admin context.
- Merchant Shopify-backed actions are blocked once a shop is inactive or the offline token is no longer connected.
- Webhook-to-sync planning is deterministic and covered by tests.
- Storefront refusal rules explicitly cover free-item requests, hidden discounts, private data, and restricted actions.
- Merchant-facing settings already expose install, webhook, cache, workflow, and document diagnostics without requiring a separate ops console.

## Tests

The test suite covers:

- merchant auth/shop scoping
- embedded bootstrap host and session-token behavior
- webhook forwarding and webhook-to-sync job selection
- storefront safety refusals and unsafe assistant regression cases
- cart-plan and dashboard schema validation
- theme app embed activation-path helpers
- approval-card UI behavior

Run all tests with:

```bash
npm test
```

## Demo flow

See [docs/demo-script.md](/Users/l/_DEV/ldev/store/docs/demo-script.md).

## Tradeoffs

- The app favors deterministic dashboards and approval cards over freeform model-generated UI.
- Shopify remains the source of truth; Convex caches only repeated high-value reads and audit/workflow state.
- Internal diagnostics are intentionally separate from merchant navigation so demo/debug surfaces stay explicit.

## Known limitations

- Internal diagnostics are route-gated in the app shell; they are still a development/admin surface rather than a polished production back-office product.
- The current submission targets one embedded admin shell and one storefront widget surface, not a full multi-role back-office product.
- Theme/app installation and custom-domain setup still require real Shopify and Convex environment configuration; this repo cannot make those platform-side changes by itself.
