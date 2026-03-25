# Auth And Shop Context

## Context
This product is a single-store Shopify app in v1. Merchants use the app from Shopify admin. Shoppers use the storefront AI anonymously on the live store. Better Auth is out of scope for merchant/shopper auth, though it may still be used for separate internal staff tooling. Multi-tenancy is out of scope for this version.

## Objective
Authenticate embedded merchant requests with Shopify session tokens, store per-shop installation state and expiring offline Admin API credentials, and map the current merchant user to a shop-scoped actor for approvals and audit logging.

## Canonical Identity Model
- `Shop` represents a connected Shopify shop.
- `ShopifyInstallation` stores the offline token, refresh token, token expiry metadata, scopes, installation status, and app metadata for the shop.
- `MerchantActor` is a local shadow record for a Shopify admin user interacting with the embedded app.
- `WidgetConfig` stores the storefront AI settings for the shop.
- `ActionAudit` stores approvals, rejections, and executed mutations for the shop.

## Shopify Auth Requirements
- Use Shopify App Bridge session tokens for embedded request authentication.
- Use Shopify managed installation and token exchange where the stack supports it cleanly.
- Store one expiring offline Admin API access token per installed shop, plus refresh state, for backend Shopify calls.
- Use Better Auth only for separate internal/staff tooling. Do not introduce Better Auth, browser login, or separate app-managed merchant credentials for merchant or shopper flows in v1.
- Do not rely on third-party cookies as the primary embedded auth mechanism.

## Request Authentication Pattern
- The embedded frontend initializes App Bridge from the `host` parameter on first load and fetches a fresh short-lived session token from App Bridge for backend requests.
- Backend handlers verify the session token from the `Authorization` header and resolve the active shop domain and Shopify user ID.
- Backend handlers load or create the matching `MerchantActor` record for audit purposes.
- Backend token exchange happens only when bootstrap or token refresh actually requires it, not on every request.
- Durable Shopify access uses the stored offline token, not the merchant session token.
- Session tokens authenticate who is using the app right now; offline tokens authorize backend calls to Shopify.

## Onboarding And Bootstrapping
- Shopify managed installation completes before the embedded app loads; the app does not own a legacy install redirect flow as its primary path.
- On the first authenticated embedded load after install, exchange the session token for an expiring offline token, then create or update the `Shop` and `ShopifyInstallation` records in Convex.
- When a merchant first opens the embedded app, create or update the `MerchantActor` record keyed to the shop and Shopify user.
- Initialize widget defaults, document containers, and diagnostics records per shop.
- Do not require a separate signup, invite, or account-creation flow for merchants in v1.

## Authorization Rules
- Every Convex query, mutation, action, and HTTP action that touches protected data must resolve the current shop before proceeding.
- Shop-scoped reads and writes must always filter by shop ID.
- There is no cross-shop admin surface in v1.
- Shopper-facing AI endpoints must never inherit merchant-admin authority just because the same shop is installed.

## Embedded Shopify App Behavior
- The embedded app uses the latest Shopify App Bridge for shell integration and session token handling.
- If the app loads without an immediately usable token, render the shell, initialize App Bridge, and then fetch protected data.
- Avoid full-page login redirects inside the embedded app after installation is complete.
- Keep the embedded experience SPA-like, even if some initial content is a lightweight shell before authenticated data arrives.

## Security Requirements
- Verify session tokens on every embedded request that touches protected state.
- Use centralized Convex helpers to resolve `requireShopContext` and `requireMerchantActor`.
- Add audit logging for install, reinstall, widget setting changes, document visibility changes, approvals, and executed mutations.
- Do not trust client-supplied shop IDs, actor IDs, roles, or host values.

## Acceptance Criteria
- A merchant user can open the app from Shopify admin and load protected data without a separate login screen.
- Backend handlers reject tampered shop identifiers even if the client payload is modified.
- The bootstrap flow stores the offline token, refresh metadata, scopes, and installation metadata for the shop.
- Approved merchant actions are audited against the shop and merchant actor without any tenant model.
