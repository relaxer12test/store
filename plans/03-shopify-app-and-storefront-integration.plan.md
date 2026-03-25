# Shopify App And Storefront Integration

## Context
The app must be a real Shopify app installed on a dev store. The merchant/admin UI is embedded in Shopify admin and is hosted from `storeai.ldev.cloud`. The shopper AI must appear on the real storefront through a theme app extension or app embed on `store.ldev.cloud` and `storedev.ldev.cloud`.

## Objective
Implement the Shopify app lifecycle, managed install/token exchange bootstrap flow, config-managed webhooks, embedded app behavior, and storefront theme app extension strategy.

## Shopify App Shape
- Build a custom-stack embedded Shopify app rather than using Shopify’s framework template.
- Use Shopify CLI and Dev Dashboard for app registration, scopes, app configuration, and extension packaging.
- Set the app URL to `https://storeai.ldev.cloud`.
- Keep the storefront domains on Shopify Online Store, not inside the TanStack app.

## Required Shopify Endpoints On Convex
- Protected merchant endpoints that verify session tokens and resolve shop context
- Webhook ingestion
- Shop bootstrap and health endpoints
- AI endpoints used by the embedded merchant app
- AI endpoints used by the storefront widget
- Optional app proxy endpoint if a same-origin storefront route becomes useful later

## Admin API Strategy
- Use GraphQL Admin API only.
- Store one expiring offline token per installed shop in Convex, along with refresh metadata.
- Pin a single stable Admin API version for the implementation and update all calls consistently.
- Keep Shopify API client creation inside Convex server utilities.

## Minimum Install Behavior
- Configure required scopes in Shopify app configuration and prefer managed installation.
- Deploy app configuration through Shopify CLI so Shopify manages install and scope changes.
- On the first authenticated embedded load after install, exchange the merchant session token for an expiring offline token and persist installation metadata.
- Manage required webhooks as app-specific subscriptions in `shopify.app.toml`, and deploy them with app configuration instead of treating them as per-shop install callbacks by default.
- Record installation status and scopes in Convex for diagnostics and audit.
- Support app re-install and scope upgrades cleanly.

## Required Scopes
- `read_products`
- `write_products`
- `read_orders`
- `read_inventory`
- `write_inventory`
- `read_locations`
- `read_themes`

Optional scopes may be added later only if a retained feature clearly requires them, such as customer tagging or extra theme diagnostics.

For shopper-facing Storefront API reads, request only the minimal unauthenticated scopes that the widget truly needs, such as `unauthenticated_read_product_listings`, `unauthenticated_read_selling_plans`, `unauthenticated_read_checkouts`, and `unauthenticated_write_checkouts`.

For the take-home dev store, `read_orders` is sufficient unless the demo truly needs more than the default recent order window. Add `read_all_orders` only if the retained product scope actually requires it and the Partner Dashboard approval is worth the complexity.

## Webhook Topics
- `app/scopes_update`
- `app/uninstalled`
- `products/create`
- `products/update`
- `products/delete`
- `collections/create`
- `collections/update`
- `collections/delete`
- `orders/create`
- `orders/updated`
- `orders/cancelled`
- `inventory_levels/update`

Add `bulk_operations/finish` only if selective backfill or index jobs start using bulk operations.

These should be app-specific, config-managed webhook subscriptions by default. Each webhook handler must be idempotent and must write a delivery log in Convex.

## Embedded Admin Experience
- The merchant app must load within Shopify admin and use App Bridge for shell integration.
- Embedded routes should resolve the current shop context from the verified session token.
- Do not treat Shopify's embedded direct Admin API access as the primary data path. Keep reads and writes that matter behind Convex so approvals, audits, and policy checks stay centralized.
- The app should stay focused on setup, settings, copilot, explorer, workflows, and diagnostics that matter to the merchant.
- Do not build a separate `/ops` surface in v1.

## Storefront AI Integration
- Implement the shopper AI through a Shopify theme app extension or app embed, not by editing theme files directly.
- Use a theme app embed as the default activation path so the widget works across themes and can be activated from the theme editor without code edits.
- The embed should mount a small client widget that talks to Convex-backed endpoints.
- Support deep linking from the embedded app into the Shopify theme editor so merchants can activate the app embed quickly.
- The widget configuration should support position, greeting, accent color, and enable/disable toggles from merchant settings.
- If the widget needs Storefront API reads, provision a Storefront access token with only the minimal unauthenticated scopes required for storefront-safe operations.
- Use an app proxy only if same-origin storefront routing becomes necessary; do not make it a v1 dependency.

## Merchant Settings Requirements
- Add settings for shop install health, webhook health, extension status, public AI enable/disable, widget branding, and public knowledge sources.
- Expose useful diagnostics directly in the embedded app without relying on a separate admin surface.

## Acceptance Criteria
- The app installs successfully on the dev store.
- The embedded admin app loads inside Shopify and uses verified session-token-backed requests.
- Webhooks are deployed through app configuration and write delivery logs.
- The theme extension or app embed can be enabled and renders the storefront AI widget on the live shop.
- App uninstall marks the shop inactive and blocks future sync or AI actions for that shop.
