# Shopify Warehouse And Sync

## Context
The AI features must query fast, structured store data without depending on slow live Shopify calls for every question. Convex is the warehouse-style source of truth for application reads, analytics, and approvals.

## Objective
Mirror the core Shopify commerce domain into Convex, keep it fresh, and expose clean query surfaces for both the shopper AI and merchant AI.

## Data Domains To Mirror
- Shops and installation metadata
- Products
- Product variants
- Collections
- Customers
- Orders
- Order line items
- Locations
- Inventory items
- Inventory levels
- Sync jobs
- Webhook deliveries
- Action audit records

## Public Versus Private Projections
- Build a sanitized `publicCatalogProjection` for storefront AI.
- Build private operational projections for merchant analytics and admin actions.
- Public projections must contain only publishable catalog data, public availability, public pricing, and safe merchandising metadata.
- Private projections may include richer order, customer, and inventory context.

## Sync Strategy
- First install triggers a full backfill job in Convex.
- Use Shopify Bulk Operations for large historical imports.
- Split backfill into separate domain jobs so failure in one domain does not invalidate the whole install.
- After backfill, rely on webhooks for incremental freshness.
- Add periodic reconciliation jobs to catch missed webhook updates.

## Required Sync Jobs
- Product and variant import
- Collection import
- Customer import
- Order import
- Inventory and location import
- Projection rebuild
- Reconciliation scan
- Shop uninstall cleanup

## Data Modeling Rules
- Store Shopify IDs in dedicated indexed fields, not only inside blobs.
- Keep normalized tables for products, variants, customers, orders, and inventory so analysis queries remain efficient.
- Retain the raw webhook payload and selected normalized fields for auditability.
- Track source timestamps and last synced timestamps per entity.

## Idempotency Rules
- Every webhook delivery must be keyed by topic plus shop plus Shopify event identity if available.
- Reprocessing the same delivery must be safe.
- Bulk imports must upsert records by stable Shopify identifiers.
- Projection rebuilds must be deterministic from normalized data.

## Query Layer Requirements
- Build explicit Convex queries for:
  - merchant overview metrics
  - sales time series
  - top products
  - low stock items
  - customer segments
  - order lookup and order detail
  - product detail and editing context
  - public product search and product detail
- Do not make the frontend compute warehouse analytics ad hoc.

## Operational Diagnostics
- Expose last sync time, last successful webhook, failed deliveries, pending jobs, and stale domain warnings.
- Make these visible in `/app/settings` for tenant admins and in `/ops` for platform admins.

## Acceptance Criteria
- Initial backfill produces usable product, customer, order, and inventory data in Convex.
- Incremental webhooks update records without duplicates.
- Public projection queries never expose private or unsafe data.
- Merchant overview screens and AI tools can answer from Convex without requiring live Shopify reads for normal use.
