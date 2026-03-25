# Foundation And App Shell

## Context
This project is a TanStack Start application deployed to Cloudflare Workers, with Convex as the only real backend. The app must support three surfaces: marketing, embedded merchant admin, and hidden platform ops. First load must render with real data already available.

## Objective
Create the application skeleton, routing model, SSR preloading pattern, shared providers, and reusable UI architecture that all later features will build on.

## Required Setup Decisions
- Scaffold from the official TanStack Start starter, not from Shopify’s app template.
- Use `pnpm` as the package manager unless the repo already standardizes differently.
- Add Convex using the current official TanStack Start integration pattern with `@convex-dev/react-query`, `@tanstack/react-query`, and `@tanstack/react-router-with-query`.
- Keep the app in a single web project plus `convex/` backend folder unless a later plan explicitly requires splitting.

## Route Inventory
- `/` marketing landing page with Tailwind Plus hero, bento, and CTA sections.
- `/install` merchant onboarding/install help.
- `/app` merchant overview.
- `/app/copilot`
- `/app/explorer`
- `/app/workflows`
- `/app/settings`
- `/ops`
- `/ops/tenants`
- `/ops/sync-jobs`
- `/ops/webhooks`
- `/ops/ai-traces`

## Provider Architecture
- Build a root router context containing `queryClient`, `viewer`, and any request-scoped preload helpers.
- Use a `ConvexQueryClient` wired into TanStack Query so route loaders can `ensureQueryData` and route components can `useSuspenseQuery`.
- Keep a single long-lived Convex client on the client side so subscriptions resume cleanly after SSR.
- Use Suspense-based query consumption in route components. Do not use undefined-loading branches for primary app routes.

## SSR Read-Through Pattern
- On initial request, the root route reads the request cookies and calls a Convex HTTP endpoint that returns a session envelope.
- The session envelope must include the authenticated viewer summary and a Convex auth token if the request is authenticated.
- The server-side Convex query client must be configured with that token before route loaders run.
- Each app route loader preloads only above-the-fold critical data with `queryClient.ensureQueryData(convexQuery(...))`.
- Each route component consumes the exact same query keys with `useSuspenseQuery` so the SSR result hydrates into live updates with no flash.

## UI Composition Rules
- Route files stay thin. They preload data, mount feature components, and avoid feature-specific logic.
- Feature code lives under domain folders such as `features/auth`, `features/storefront-ai`, `features/merchant-ai`, `features/shopify`, `features/documents`, and `features/ops`.
- Shared UI primitives live under `components/ui`.
- Create wrapper modules for:
  - `ui/form`
  - `ui/table`
  - `ui/ai`
  - `ui/layout`
  - `ui/feedback`
- Tailwind Plus and Catalyst code must be wrapped behind local components so licensed snippets can be swapped in without refactoring feature logic.

## Form Composition Contract
- Every significant form uses a top-level `MainForm` wrapper.
- Field components must consume form context rather than creating their own standalone form state.
- Provide reusable pieces such as `FormSection`, `FormTextField`, `FormTextareaField`, `FormSelectField`, `FormCheckboxField`, and `FormSubmitBar`.
- Do not call raw TanStack Form hooks in page components or feature leaf components.

## Table Composition Contract
- Build a single reusable table shell around TanStack Table for explorer grids, ops grids, and dashboard tables.
- Support server-fed data, column definitions, filters, sorting, empty states, and row actions.
- Keep table rendering generic and inject feature-specific cell renderers through props.

## Design System Direction
- Marketing pages should intentionally use Tailwind Plus bento and strong visual hierarchy.
- App pages should feel more operational and information-dense.
- Define CSS variables and tokens early so the storefront widget, marketing site, and admin app remain coherent without sharing identical layouts.

## Acceptance Criteria
- A fresh app boots with the route map above.
- The root provider stack supports Convex SSR preloading and client reactivity.
- At least one protected route demonstrates the no-spinner first-load pattern.
- The shared UI and form architecture is established before feature work begins.
