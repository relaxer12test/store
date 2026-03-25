# Storefront AI Concierge

## Context
The storefront AI is public and shopper-facing. It runs on the live Shopify storefront through a theme app embed. It must improve product discovery and cart building without ever creating unsafe commerce outcomes such as free products, hidden discounts, or access to private merchant data.

## Objective
Build a safe, useful shopper AI widget that runs on the live Shopify storefront and uses a tightly constrained Convex toolset backed by storefront-safe data sources.

## Shopper Use Cases
- Ask product discovery questions.
- Compare products and collections.
- Explain store policies and FAQs.
- Recommend bundles or complementary items.
- Build a cart plan that the shopper can apply to the storefront cart.
- Answer availability questions using only public availability data.

## Hard Safety Boundary
- The shopper AI must never call Shopify Admin APIs.
- The shopper AI must never mint or promise discounts.
- The shopper AI must never invent price overrides or free items.
- The shopper AI must never expose hidden inventory quantities or unpublished products.
- The shopper AI must never access order history, merchant-private documents, or private operational data.
- The shopper AI must not execute checkout, payment, refund, or account actions.

## Allowed Tool Registry
- `searchCatalog`
- `getProductDetail`
- `compareProducts`
- `searchCollections`
- `answerPolicyQuestion`
- `recommendBundle`
- `buildCartPlan`

Each tool must run on Convex and read only from storefront-safe sources such as Storefront API data, a sanitized public catalog index, and public documents.

## Storefront API Auth
- If the widget or Convex tools use the Storefront API, provision a Storefront access token with only the unauthenticated scopes that are actually needed.
- Never expose Shopify Admin tokens, offline tokens, or merchant session tokens to the storefront widget.
- Keep browser-side Storefront API usage limited to storefront-safe product, collection, and cart operations.

## Cart Plan Contract
- The model may output a structured `CartPlan` only.
- `CartPlan` may contain variant IDs, quantities, optional note text, and optional explanation.
- `CartPlan` must not contain price fields, discount fields, or hidden metadata.
- The browser applies the cart plan through Shopify storefront-safe cart APIs so Shopify recalculates price and eligibility server-side.

## Prompt And Policy Design
- Use a dedicated storefront system prompt that frames the agent as a shopping concierge, not an operations agent.
- Tell the model explicitly that it has no power to modify store pricing or grant benefits.
- Add deterministic policy checks before and after tool calls.
- Reject prompts that attempt fraud, abuse, hidden pricing, or policy bypass.
- Validate all model outputs against strict schemas before rendering or acting on them.

## Data Sources
- Storefront API product, collection, and cart-safe data.
- Optional sanitized public catalog index in Convex for repeated retrieval.
- Public policy and FAQ documents from the document ingestion pipeline.
- Merchant-authored canned answers for shipping, returns, and contact policies.

## UI Requirements
- Ship the widget as a Shopify theme app embed, not as a standalone marketing-site component.
- Deep link merchants from the embedded app into the theme editor so the app embed can be activated quickly.
- Support launcher, drawer, and mobile-friendly full-height states.
- Show quick prompts and product chips for common entry points.
- Render structured product recommendation cards and cart plan cards instead of long generic prose whenever possible.
- Make refusal messages explicit and calm when requests cross policy boundaries.

## Abuse Controls
- Add per-IP or per-session rate limiting in Convex.
- Log public AI prompts, outcomes, and refusal reasons without storing sensitive shopper data.
- Keep a moderation flag table for suspicious patterns and future blocking.
- Leave room for optional Turnstile integration later if abuse appears.

## Acceptance Criteria
- Shoppers can discover products and add recommended items to cart through a safe cart plan.
- Unsafe requests such as “make this free” or “generate a secret discount” are refused consistently.
- The widget never exposes private merchant data.
- The agent answers from storefront-safe product data and public documents only.
