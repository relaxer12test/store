# Merchant Copilot And Dashboard

## Context
The embedded merchant surface is the main take-home showcase. It must feel like a serious operational product inside Shopify admin, not just a chat box. The merchant AI has broader authority than the storefront AI, but all side effects must be explicit, approved, and audited.

## Objective
Build a merchant copilot that can answer operational questions, drive structured dashboards, and perform approved Shopify admin actions through Convex.

## Merchant Surface Inventory
- Overview dashboard
- Copilot chat
- Explorer tables
- Workflows
- Settings

There is no separate `/ops` surface in v1.

## Merchant AI Capabilities
- Answer questions about products, sales, orders, and inventory.
- Generate structured dashboard cards from direct Shopify reads and/or Convex cached metrics.
- Suggest merchandising and operational actions.
- Execute approved actions against Shopify through Convex.
- Summarize uploaded documents and blend them with Shopify facts.

For order analytics, design the default dashboard and copilot flows around the dev-store/demo order window. Add `read_all_orders` only if the retained demo or product scope truly requires historical order coverage beyond the default range.

## Allowed Read Tools
- `getOverviewMetrics`
- `getSalesTrend`
- `getTopProducts`
- `getLowStockItems`
- `searchOrders`
- `getOrderDetail`
- `searchProducts`
- `getProductEditContext`
- `searchDocuments`

## Allowed Write Tools
- `updateProductContent`
- `updateProductTags`
- `updateProductStatus`
- `updateProductMetafields`
- `adjustInventory`
- `enqueueWorkflow`

Do not add pricing, discount, refund, fulfillment, or cancellation tools in v1.

## Approval Model
- The model may propose write operations, but it must not execute them silently.
- Every write tool call becomes a structured approval card in the UI.
- The approval card must show target shop, affected entity, planned changes, and a concise risk summary.
- Only after explicit human approval may Convex execute the Shopify mutation.
- Every approved or rejected action is written to `ActionAudit`.

## Dashboard Contract
- AI-generated dashboards must resolve to a strict `DashboardSpec`.
- Allowed card types are `metric`, `line_chart`, `bar_chart`, `table`, and `insight`.
- The frontend renders cards from the schema. Never render raw model-generated HTML.
- Default dashboards should load from deterministic Shopify queries or Convex cached metrics even before AI customization.

## Explorer Requirements
- Use TanStack Table wrappers for products, orders, inventory, documents, and audit logs.
- Support search, filter, sorting, column visibility, and row drill-in.
- Explorer screens should be useful even without touching the AI chat.

## Workflow Requirements
- Convex workflows should cover recurring or async-heavy tasks such as cache refresh, sync replay, dashboard regeneration, and document re-index.
- Workflows must surface status, logs, retry state, and final outcome in the UI.

## UX Requirements
- Keep the embedded surface focused and useful without requiring a second admin application.
- The chat area should render tool results as structured cards, tables, and charts.
- Keep the overview useful without requiring chat.
- Preserve conversation context per shop.
- Make model activity visible without noisy spinner-driven UX.

## Acceptance Criteria
- Merchant users can ask operational questions and get grounded answers from Shopify data, Convex documents, and any retained caches.
- Merchant users can approve safe write actions and see them applied to Shopify.
- AI-generated dashboard cards render from validated schemas.
- Explorer and workflow views are independently useful and not dependent on chat.
