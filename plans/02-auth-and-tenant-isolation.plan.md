# Auth And Tenant Isolation

## Context
This product has merchant/admin users and platform-admin users. Shoppers use the storefront AI anonymously and do not use Better Auth. Better Auth is the canonical session system for human users who log into the app surfaces.

## Objective
Implement Better Auth fully on Convex, map Shopify-installed shops to tenants, establish role-based membership, and make SSR-friendly authenticated first load possible.

## Canonical Identity Model
- `Tenant` represents a merchant organization.
- `Shop` represents a connected Shopify shop and belongs to one tenant.
- `User` comes from Better Auth.
- `TenantMembership` links a Better Auth user to a tenant with a role.
- Roles are `platform_admin`, `tenant_admin`, and `tenant_member`.
- `ShopifyInstallation` stores the offline token, scope set, installation status, and Shopify metadata for a shop.

## Better Auth Requirements
- Use `@convex-dev/better-auth` and keep all Better Auth routes mounted on Convex HTTP actions.
- Configure cookie settings for embedded Shopify use. The cookie policy must support iframe embedding, so production cookies must be `Secure` and compatible with `SameSite=None`.
- Do not implement parallel ad hoc session tables outside the Better Auth integration unless required for app metadata.
- Keep Better Auth as the canonical browser session even when the request originated from Shopify admin embedding.

## Session Envelope Pattern
- Create a Convex HTTP endpoint that accepts the incoming request cookies and returns:
  - authenticated user summary
  - active tenant summary
  - active shop summary if present
  - role list
  - Convex auth token for SSR preloading
- TanStack Start must call this endpoint during SSR before route loaders execute.
- Client hydration must reuse the same viewer context so the first interactive frame matches server-rendered state.

## Onboarding And Bootstrapping
- When the Shopify app is first installed for a shop, create or attach the tenant and shop records in Convex.
- The installing merchant becomes the initial `tenant_admin`.
- Platform admins are created through a controlled internal flow, not public signup.
- Additional tenant users are invited from the merchant app and complete Better Auth onboarding before gaining access.

## Authorization Rules
- Every Convex query, mutation, action, and HTTP action that touches tenant data must resolve the current viewer and tenant before proceeding.
- Tenant-scoped reads and writes must always filter by tenant ID.
- Platform admins may cross tenant boundaries only inside `/ops` or internal maintenance workflows.
- Shopper-facing AI endpoints must never resolve to tenant-admin permissions just because a shop is public.

## Embedded Shopify App Behavior
- The embedded app uses Shopify App Bridge for UX integration, but App Bridge is not the canonical auth system.
- If a merchant arrives through Shopify without an active Better Auth session, the app must run a one-time bootstrap flow that creates the Better Auth session and then returns to the embedded route.
- Once the Better Auth cookie exists, SSR should be able to preload authenticated data with no loading flash.

## Security Requirements
- Use helper functions in Convex to centralize `requireViewer`, `requireTenantMember`, `requireTenantAdmin`, and `requirePlatformAdmin`.
- Add audit logging for invites, role changes, shop attachments, and session bootstrap actions.
- Do not trust client-supplied tenant IDs, shop IDs, or roles.

## Acceptance Criteria
- A merchant user can sign in, refresh a protected page, and see fully rendered authenticated data on first load.
- A platform admin can access `/ops` and tenant users cannot.
- Cross-tenant access is denied at the backend even if the client tampers with route params or payloads.
- A shop installation can bootstrap a tenant and its first admin user without manual database editing.
