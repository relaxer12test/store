# Foundation And App Shell

## Context
This project is a TanStack Start application deployed to Cloudflare Workers at `storeai.ldev.cloud`, with Convex as the real backend. Shopify owns the storefront on `store.ldev.cloud` and `storedev.ldev.cloud`. The app itself needs two surfaces: a lightweight public shell and an embedded merchant admin surface inside Shopify.

## Objective
Create the application skeleton, routing model, embedded-app bootstrap pattern, shared providers, and reusable UI architecture that all later features will build on.

## Required Setup Decisions
- Scaffold from the official TanStack Start starter, not from Shopify’s framework template.
- Keep the repo’s existing `npm` and Vite+ toolchain unless a later migration is justified.
- Add Convex using the current TanStack Start integration pattern with `@convex-dev/react-query`, `@tanstack/react-query`, and `@tanstack/react-router-with-query`.
- Keep the app in a single web project plus `convex/` backend folder unless a later plan explicitly requires splitting.
- Configure the worker app to serve from `storeai.ldev.cloud`.
- Load the latest Shopify App Bridge script on embedded HTML documents instead of inventing a custom embedded shell protocol.

## Route Inventory
- `/` app landing page and install/help surface on `storeai.ldev.cloud`
- `/install` merchant onboarding/install help
- `/app` embedded merchant overview
- `/app/copilot`
- `/app/explorer`
- `/app/workflows`
- `/app/settings`
- `/internal` dev-only internal diagnostics/debug shell on `storeai.ldev.cloud`

There is no `/ops` route family in v1.

## Provider Architecture
- Build a root router context containing `queryClient`, request helpers, and Shopify/App Bridge boot state.
- Keep a single long-lived Convex client on the client side so subscriptions and query state survive embedded navigation.
- Keep a single long-lived App Bridge integration on the client side for host persistence, admin chrome APIs, and session token acquisition.
- Use Suspense-based query consumption where it helps the embedded app feel smooth, but do not require SSR-authenticated data for embedded routes.
- Prefer query prefetch and retained previous content during route transitions over spinner-heavy loading states.

## Embedded App Bootstrap Pattern
- The initial request serves the app shell from `storeai.ldev.cloud`.
- App Bridge initializes from the `host` value provided by Shopify on the initial embedded load, and that host is preserved for later client-side navigation.
- After load, the embedded frontend obtains a fresh Shopify session token from App Bridge for backend requests.
- The frontend includes the session token in the `Authorization` header on requests to backend endpoints.
- Convex or worker-side request helpers verify the session token, resolve the active shop and merchant actor, and then load shop-scoped data.
- Embedded route loaders and components should share the same query keys once auth state is established on the client.
- Do not design the embedded app around cookie-based SSR session envelopes or URL-parsed session tokens as the normal auth path.

## UI Composition Rules
- Route files stay thin. They mount feature components and avoid feature-specific logic.
- Feature code lives under domain folders such as `features/shopify`, `features/storefront-ai`, `features/merchant-ai`, `features/documents`, and `features/settings`.
- Shared UI primitives live under `components/ui`.
- Create wrapper modules for:
  - `ui/form`
  - `ui/table`
  - `ui/ai`
  - `ui/layout`
  - `ui/feedback`
- Tailwind Plus and Catalyst code must be wrapped behind local components so licensed snippets can be swapped in without refactoring feature logic.

## Internal Dev Console Rules
- `/internal` exists only to help us inspect install state, webhook deliveries, cached data, action audits, and debug flows while building.
- Keep it completely separate from merchant navigation and merchant authorization assumptions.
- Gate it behind explicit environment checks and staff-only access controls before it ever exists outside local development.
- If `/internal` survives beyond local development, it may use a separate Better Auth staff login, but that auth must stay isolated from merchant and shopper flows.
- Treat it as disposable support tooling, not a productized platform-admin surface.

## Form Composition Contract
- Every significant form uses a top-level `MainForm` wrapper.
- Field components must consume form context rather than creating their own standalone form state.
- Provide reusable pieces such as `FormSection`, `FormTextField`, `FormTextareaField`, `FormSelectField`, `FormCheckboxField`, and `FormSubmitBar`.
- Do not call raw TanStack Form hooks in page components or feature leaf components.

## Table Composition Contract
- Build a single reusable table shell around TanStack Table for explorer grids, workflow queues, audit logs, and dashboard tables.
- Support server-fed data, column definitions, filters, sorting, empty states, and row actions.
- Keep table rendering generic and inject feature-specific cell renderers through props.

## Design System Direction
- The public app shell on `storeai.ldev.cloud` can use stronger marketing hierarchy.
- Embedded app pages should feel operational, compact, and credible inside Shopify admin.
- The storefront widget should share tokens and typography direction with the app without pretending to own the entire storefront design.
- Define CSS variables and tokens early so the storefront widget and admin app remain coherent without sharing identical layouts.

## Acceptance Criteria
- A fresh app boots with the route map above.
- The root provider stack supports Convex client reactivity and embedded-app bootstrap.
- At least one embedded route demonstrates smooth client-side data loading without full-page auth redirects.
- The shared UI and form architecture is established before feature work begins.
