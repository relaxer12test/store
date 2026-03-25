# Shopify App And Storefront Integration

## Context
The app must be a real Shopify app installed on a dev store. The merchant/admin UI is embedded in Shopify admin. The shopper AI must appear on the real storefront through a theme integration. Convex owns all integration endpoints.

## Objective
Implement the Shopify app lifecycle, OAuth/install flow, webhook registration, embedded app behavior, and storefront theme extension strategy.

## Shopify App Shape
- Build a custom-stack embedded Shopify app rather than using Shopify’s framework template.
- Use Shopify CLI and Partner Dashboard only for app registration, environment setup, and extension packaging.
- All runtime endpoints point at Convex custom-domain HTTP actions.

## Required Shopify Endpoints On Convex
- Install entrypoint
- OAuth start
- OAuth callback
- Webhook ingestion
- Any shop/session bootstrap endpoint required by the embedded app
- Any extension data endpoint required by the storefront widget

## Admin API Strategy
- Use GraphQL Admin API only.
- Store one offline token per installed shop in Convex.
- Pin a single stable Admin API version for the entire implementation and update all calls consistently.
- Keep Shopify API client creation inside Convex server utilities.

## Minimum OAuth And Install Behavior
- Validate shop domains before initiating OAuth.
- Persist installation metadata only after successful token exchange.
- Register required webhooks immediately after install.
- Record installation status and scopes in Convex for audit and diagnostics.
- Support app re-install and scope upgrades cleanly.

## Required Scopes
- `read_products`
- `write_products`
- `read_customers`
- `write_customers`
- `read_orders`
- `read_inventory`
- `write_inventory`
- `read_locations`

Only add more scopes if a later feature truly requires them.

## Webhook Topics
- `app/uninstalled`
- `products/create`
- `products/update`
- `products/delete`
- `collections/create`
- `collections/update`
- `collections/delete`
- `customers/create`
- `customers/update`
- `orders/create`
- `orders/updated`
- `orders/cancelled`
- `inventory_levels/update`

Each webhook handler must be idempotent and must write a delivery log in Convex.

## Embedded Admin Experience
- The merchant app must load within Shopify admin and use App Bridge for shell integration.
- Embedded routes should restore the current shop context automatically.
- The merchant app should detect missing Better Auth session state and run the bootstrap flow before rendering protected features.

## Storefront AI Integration
- Implement the shopper AI through a Shopify theme app extension or app embed, not by editing theme files directly.
- The embed should mount a small client widget that talks to Convex HTTP endpoints.
- The widget configuration should support position, greeting, accent color, and enable/disable toggles from merchant settings.
- All AI decisions and catalog retrieval still happen on Convex, never in a standalone browser-only bundle.

## Merchant Settings Requirements
- Add settings for shop install health, webhook health, extension status, public AI enable/disable, widget branding, and public knowledge sources.
- Expose useful diagnostics to tenant admins without making them use `/ops`.

## Acceptance Criteria
- The app installs successfully on the dev store.
- The embedded admin app loads inside Shopify.
- Webhooks register and write delivery logs.
- The theme extension/app embed can be enabled and renders the storefront AI widget on the live shop.
- App uninstall marks the shop inactive and blocks future sync or AI actions for that shop.
