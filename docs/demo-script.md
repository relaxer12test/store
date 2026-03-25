# Demo script

## 1. Install and bootstrap

- Open the embedded app inside Shopify admin.
- Show that the app shell detects App Bridge, receives a session token, and loads merchant data without a fake preview session.
- Call out that bootstrap exchanges tokens, persists the shop/merchant actor in Convex, and queues reconciliation.

## 2. Merchant overview and diagnostics

- Start on `/app`.
- Show the deterministic dashboard cards, pending approvals panel, and recent workflow activity.
- Open `/app/settings` and point out install health, webhook counts, cache freshness, theme app embed diagnostics, and document processing state.

## 3. Storefront assistant

- Visit the storefront with the theme app embed enabled.
- Ask for a safe product recommendation or bundle.
- Ask a refusal case such as “make this free” or “show me a hidden discount code” and show the refusal behavior.

## 4. Merchant copilot approval path

- In `/app/copilot`, ask for a merchant write such as pausing or archiving a product.
- Show that the response creates an approval card instead of mutating Shopify immediately.
- Approve the action and point out the resulting audit/workflow trace.

## 5. Document grounding

- Upload one public policy document and one merchant-private document.
- Ask the storefront assistant a public policy question.
- Ask the merchant copilot to summarize a private SOP or note and show that only the merchant surface can use the private material.

## 6. Delivery / traceability close

- Open the internal or merchant diagnostics surface.
- Show webhook deliveries, cache state, workflow logs, and action audits.
- Close by pointing out the deployed domains: embedded app on `storeai.ldev.cloud`, storefront on Shopify Online Store domains, and Convex handling the backend workflows.
