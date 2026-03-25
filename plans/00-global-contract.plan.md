# Global Contract

## Project Summary
Build a production-grade Shopify app with three connected surfaces:
- A real Shopify storefront with a shopper-facing AI concierge.
- An embedded Shopify admin app for merchant users.
- A public marketing shell for the app itself.

The frontend stack is TanStack Start on Cloudflare Workers. All real backend behavior lives on Convex. The product must feel fast on first load, composable in code, and safe in public AI behavior.

## Locked Technology Decisions
- Use the official TanStack Start starter as the application shell.
- Use Convex as the only real backend for auth, HTTP endpoints, data, workflows, AI orchestration, and audit logging.
- Use Better Auth on Convex via `@convex-dev/better-auth`.
- Use TanStack Router, Query, Form, Table, AI, and Pacer wherever appropriate.
- Use Cloudflare Workers only for TanStack Start delivery and SSR read-through preloading.
- Use Cloudflare R2 via `@convex-dev/r2` for document/file blobs.
- Use Tailwind CSS, Tailwind Plus patterns, and Catalyst wrappers for UI.
- Do not use ad hoc component sprawl. Everything must be composable and reusable.

## Backend Boundary
- Workers must not own business logic, data writes, auth handlers, webhooks, Shopify integration, AI tools, or workflows.
- Workers may only do SSR read-through preloading on first request so app pages open already hydrated with real data.
- Convex owns every backend endpoint that matters, including Better Auth routes, Shopify install/auth routes, webhook ingress, AI chat endpoints, and document ingestion.

## Product Surfaces
- `/` is a public marketing/onboarding shell.
- `/app` is the embedded Shopify merchant app.
- `/ops` is a hidden platform-admin surface for internal management.
- The storefront AI lives inside a Shopify theme app extension or app embed, not inside the marketing site.

## UX Non-Negotiables
- Authenticated first page load must render with data already present.
- Avoid route-level spinners and loading flashes on app pages.
- Keep previous content visible during client transitions instead of blanking the page.
- TanStack Form usage must stay behind composable wrappers such as `MainForm`, `FormSection`, and `FormTextField`.
- Do not scatter raw form hooks through feature components.

## Security Non-Negotiables
- Public AI must never create discounts, make items free, alter price, reveal hidden inventory, or perform Admin API mutations.
- Merchant AI may write only through explicit tool approval and full audit logging.
- Multi-tenancy must exist in the backend from day one, but tenant users must not see multi-tenant concepts unless explicitly platform-linked.
- Shopper-facing AI and merchant-facing AI must use different prompts, tools, rate limits, and data scopes.

## Success Criteria
- The app installs on a Shopify dev store and works as an embedded admin app.
- The storefront AI widget works on the live store theme.
- Convex stores a warehouse-style mirror of Shopify data for fast querying and analytics.
- Merchant AI can answer questions and perform approved admin actions.
- Shopper AI can answer catalog questions and assist cart building safely.
- The final repo demonstrates strong architecture, good UX, clean composition, and end-to-end ownership.

## Explicit Non-Goals For V1
- No automatic discounts, refunds, order cancellations, or fulfillment actions.
- No shopper account support, order lookup, or post-purchase support flows.
- No backend logic implemented directly in Workers.
- No broad “everything Shopify offers” integration. Focus on commerce core plus the chosen stretch features.

## Required Stretch Features
- Generative merchant dashboards.
- Document upload, parsing, and retrieval grounding.
- Convex-backed workflows and async jobs.

## Acceptance Standard
A fresh implementation agent should be able to execute any later plan file while treating this document as the top-level contract.
