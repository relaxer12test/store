import { v } from "convex/values";
import type {
	InstallGuideSnapshot,
	MarketingSnapshot,
	MerchantOverviewSnapshot,
	ModuleSnapshot,
	OpsOverviewSnapshot,
} from "../src/shared/contracts/app-shell";
import { query } from "./_generated/server";

const marketingSnapshotData: MarketingSnapshot = {
	heroEyebrow: "Growth Capital takehome",
	heroTitle:
		"A Shopify AI app with a real storefront concierge and an operator-grade admin surface.",
	heroSummary:
		"The shell is TanStack Start on Cloudflare Workers. All behavior that matters, from auth envelopes to warehouse queries and AI safety rails, stays in Convex.",
	heroStats: [
		{
			label: "First-load contract",
			value: "SSR",
			delta: "Hydrated",
			hint: "Each route preloads the exact query key it later consumes with useSuspenseQuery.",
			tone: "accent",
		},
		{
			label: "Backend boundary",
			value: "Convex",
			delta: "Only",
			hint: "Workers deliver the app shell and SSR read-through data, but they do not own business logic.",
			tone: "success",
		},
		{
			label: "Public AI safety",
			value: "0",
			delta: "Admin writes",
			hint: "Shopper AI is retrieval-only and cannot mutate discounts, prices, inventory, or Shopify admin state.",
			tone: "watch",
		},
		{
			label: "Surfaces",
			value: "3",
			delta: "Connected",
			hint: "Marketing, embedded merchant app, and hidden ops are all represented in the foundation.",
			tone: "neutral",
		},
	],
	proofPoints: [
		{
			title: "Merchant app",
			summary:
				"Operational layout with composable routes for copilot, explorer, workflows, and settings.",
			detail:
				"Thin route files preload data and hand off rendering to feature modules so later Shopify and auth work does not have to unwind page logic.",
		},
		{
			title: "Storefront concierge",
			summary:
				"Separate safety boundary for anonymous shoppers with its own prompts, tools, and rate limits.",
			detail:
				"The marketing shell already communicates the embedded widget strategy and keeps public AI clearly distinct from merchant authority.",
		},
		{
			title: "Warehouse pattern",
			summary:
				"Convex queries define the presentation contract for metrics, tables, diagnostics, and AI context.",
			detail:
				"Later sync plans can swap the static demo snapshots here for normalized Shopify mirrors without touching route structure.",
		},
		{
			title: "Composability",
			summary: "Reusable wrappers exist now for forms, tables, layout, feedback, and AI threads.",
			detail:
				"This avoids component sprawl and keeps later feature slices additive instead of requiring a UI rewrite.",
		},
	],
	installSteps: [
		"Scaffold from the official TanStack Start starter with the Cloudflare deployment adapter and npm.",
		"Add Convex as the only real backend and preload critical route data via TanStack Query during SSR.",
		"Mount Better Auth on Convex HTTP actions so embedded Shopify sessions can bootstrap into canonical browser sessions.",
		"Register Shopify install, OAuth, webhook, and storefront endpoints on Convex instead of the worker runtime.",
	],
	storefrontCallout:
		"The live storefront widget will ship as a theme app extension or app embed. It can answer catalog questions, guide cart building, and ground on approved knowledge without ever inheriting merchant admin permissions.",
};

const installGuideData: InstallGuideSnapshot = {
	title: "Install and bootstrap path",
	summary:
		"This slice uses a same-origin preview cookie so the SSR session envelope contract is already testable before Better Auth is wired to Convex.",
	checklist: [
		"Run Convex in anonymous agent mode locally or connect a real dev deployment.",
		"Use `/install` to enter merchant or platform preview mode.",
		"Refresh `/app` or `/ops` and confirm the first rendered frame already contains data.",
		"Replace the preview cookie bridge with Better Auth session bootstrap in plan 02.",
	],
	notes: [
		{
			label: "Current bridge",
			detail:
				"Preview mode is intentionally temporary. It proves the SSR session-envelope flow without locking us into a fake auth architecture.",
			tone: "watch",
		},
		{
			label: "Next auth step",
			detail:
				"Better Auth on Convex will become the canonical session layer, with Shopify embed bootstrap mapping the merchant to a tenant and shop.",
			tone: "accent",
		},
	],
};

const merchantOverviewData: MerchantOverviewSnapshot = {
	title: "Northwind Atelier",
	summary:
		"Protected merchant surface with server-preloaded overview metrics. This route is the concrete proof of the no-spinner first-load pattern in the foundation plan.",
	metrics: [
		{
			label: "Catalog mirrored",
			value: "4.2k",
			delta: "99.1%",
			hint: "Projected product and variant coverage once the warehouse sync is online.",
			tone: "success",
		},
		{
			label: "Low stock watch",
			value: "38",
			delta: "Needs routing",
			hint: "These items will become actionable inventory workflows in later slices.",
			tone: "watch",
		},
		{
			label: "Support deflection",
			value: "61%",
			delta: "Preview",
			hint: "Storefront AI can absorb repetitive catalog and availability questions.",
			tone: "accent",
		},
		{
			label: "Install posture",
			value: "Healthy",
			delta: "Webhooks ready",
			hint: "Shop install health, webhook registration, and extension posture roll up here.",
			tone: "neutral",
		},
	],
	signals: [
		{
			label: "SSR session envelope",
			detail:
				"Merchant routes inherit viewer context from the root beforeLoad, so role checks happen before child loaders fire.",
			tone: "success",
		},
		{
			label: "Copilot write safety",
			detail:
				"Admin actions stay approval-gated and audit-logged. Public AI never shares this authority boundary.",
			tone: "accent",
		},
		{
			label: "Shopify install health",
			detail:
				"Once the install flow lands, this section will surface scope drift, webhook failures, and extension disablement.",
			tone: "watch",
		},
	],
	timeline: [
		{
			title: "Wire Better Auth bootstrap",
			detail:
				"Attach the embedded merchant to a canonical Better Auth session on first arrival from Shopify admin.",
			meta: "Plan 02",
		},
		{
			title: "Register Shopify webhooks",
			detail:
				"Create install, OAuth callback, and webhook ingress endpoints on Convex and persist installation metadata.",
			meta: "Plan 03",
		},
		{
			title: "Backfill warehouse projections",
			detail:
				"Mirror products, variants, collections, customers, orders, and inventory into normalized Convex tables.",
			meta: "Plan 04",
		},
	],
};

const merchantModules: Record<"copilot" | "explorer" | "workflows" | "settings", ModuleSnapshot> = {
	copilot: {
		eyebrow: "Merchant AI",
		title: "Merchant copilot",
		summary:
			"Preview conversation shell for questions, dashboards, and approval-routed actions. The UI wrapper is in place before the actual AI orchestration arrives.",
		chips: ["Approval gated", "Tenant scoped", "Audit ready"],
		signals: [
			{
				label: "Prompt boundary",
				detail:
					"Merchant AI can inspect operational data and suggest actions, but action execution will always require explicit approval and audit logging.",
				tone: "accent",
			},
			{
				label: "Data source",
				detail:
					"Answers are designed to ground on Convex warehouse queries, not direct live Shopify calls for every request.",
				tone: "success",
			},
		],
		timeline: [
			{
				title: "Add TanStack AI middleware",
				detail:
					"Introduce merchant-specific tools, summaries, and workflow-triggering affordances.",
				meta: "Plan 06",
			},
			{
				title: "Ground on uploaded documents",
				detail: "Blend product, policy, and merchant-authored knowledge from R2-backed documents.",
				meta: "Plan 07",
			},
		],
		messages: [
			{
				id: "m1",
				role: "system",
				content:
					"You are the merchant copilot. Stay tenant-scoped, request approval before mutations, and log all proposed actions.",
				tag: "prompt policy",
			},
			{
				id: "m2",
				role: "user",
				content: "Which products are most at risk of selling out this weekend?",
			},
			{
				id: "m3",
				role: "assistant",
				content:
					"Three travel totes show low stock against recent demand. I can draft a replenishment plan or prepare an approval request for inventory adjustments.",
				tag: "warehouse answer",
			},
		],
	},
	explorer: {
		eyebrow: "Merchant data",
		title: "Explorer",
		summary:
			"Reusable table shell around TanStack Table for operational grids, filters, and row-level drill-ins.",
		chips: ["Table shell", "SSR ready", "Composable cells"],
		signals: [
			{
				label: "Normalized records",
				detail:
					"Explorer tables will read from normalized Convex warehouse tables rather than forcing the frontend to compute projections ad hoc.",
				tone: "success",
			},
		],
		timeline: [
			{
				title: "Add server-driven filters",
				detail:
					"Later modules can plug real filter state and row actions into the same table shell.",
				meta: "Plan 04",
			},
		],
		records: [
			{
				id: "sku-1",
				availability: "42 units",
				collection: "Travel edit",
				product: "Canvas Weekender",
				status: "Healthy",
			},
			{
				id: "sku-2",
				availability: "8 units",
				collection: "City carry",
				product: "Compact Utility Tote",
				status: "Low stock",
			},
			{
				id: "sku-3",
				availability: "14 units",
				collection: "Spring arrival",
				product: "Modular Tech Pouch",
				status: "Needs review",
			},
		],
	},
	workflows: {
		eyebrow: "Async jobs",
		title: "Workflows",
		summary:
			"Convex-backed jobs and async orchestration will land here, from warehouse backfills to document parsing and reconciliation scans.",
		chips: ["Convex jobs", "Retryable", "Auditable"],
		signals: [
			{
				label: "Backfill orchestration",
				detail:
					"Full install backfills will be split by domain so one failure does not invalidate the entire sync pipeline.",
				tone: "accent",
			},
			{
				label: "Reconciliation cadence",
				detail: "Periodic scans will catch missed webhook updates and projection drift.",
				tone: "watch",
			},
		],
		timeline: [
			{
				title: "Bulk import products and orders",
				detail:
					"Kick off Shopify bulk operations and project results into normalized Convex tables.",
				meta: "Plan 04",
			},
			{
				title: "Process documents and enrich AI context",
				detail: "Parse uploaded files, chunk them, and store embeddings or retrieval metadata.",
				meta: "Plan 07",
			},
		],
	},
	settings: {
		eyebrow: "Merchant settings",
		title: "Settings",
		summary:
			"Settings, install diagnostics, widget branding, and public AI controls converge here. The preview form already follows the wrapper contract.",
		chips: ["MainForm", "Form sections", "Composable controls"],
		signals: [
			{
				label: "Widget health",
				detail:
					"This page will surface extension status, public AI enablement, and install diagnostics without sending merchants to `/ops`.",
				tone: "neutral",
			},
		],
		timeline: [
			{
				title: "Persist merchant controls",
				detail:
					"Replace the local preview form with authenticated Convex mutations once Better Auth and tenant checks are in place.",
				meta: "Plan 02/03",
			},
		],
	},
};

const opsOverviewData: OpsOverviewSnapshot = {
	title: "Platform operations",
	summary:
		"Role-gated surface for cross-tenant oversight, sync posture, and AI governance. It stays hidden from merchant users even in preview mode.",
	metrics: [
		{
			label: "Tenants tracked",
			value: "12",
			delta: "+2 this week",
			hint: "Installs, re-installs, and dormant shops will eventually roll up here.",
			tone: "accent",
		},
		{
			label: "Failed jobs",
			value: "3",
			delta: "Investigate",
			hint: "Representative sync backlog signal for the eventual Convex workflow queue.",
			tone: "watch",
		},
		{
			label: "Webhook drift",
			value: "1.4%",
			delta: "Stable",
			hint: "Diagnostics surface for missed or duplicated webhook deliveries.",
			tone: "neutral",
		},
		{
			label: "AI approvals",
			value: "24",
			delta: "Today",
			hint: "Cross-tenant view into merchant copilot action approvals and trace volume.",
			tone: "success",
		},
	],
	signals: [
		{
			label: "Tenant isolation",
			detail:
				"Every tenant-facing write path will resolve the viewer and tenant in Convex before touching data.",
			tone: "success",
		},
		{
			label: "Webhook backlog",
			detail:
				"A handful of inventory updates need replay handling after the sync pipeline is introduced.",
			tone: "watch",
		},
	],
	timeline: [
		{
			title: "Stand up install audit trail",
			detail: "Track install, bootstrap, invite, and role-change events centrally in Convex.",
			meta: "Plan 02/03",
		},
		{
			title: "Expose sync diagnostics",
			detail:
				"Bring failed jobs, stale domains, and reconciliation alerts into `/ops` and `/app/settings`.",
			meta: "Plan 04",
		},
	],
};

const opsModules: Record<"tenants" | "sync-jobs" | "webhooks" | "ai-traces", ModuleSnapshot> = {
	tenants: {
		eyebrow: "Tenant directory",
		title: "Tenant roster",
		summary:
			"Controlled cross-tenant visibility for platform admins only. This is where installation posture, ownership, and bootstrap health converge.",
		chips: ["Platform only", "Cross-tenant", "Install aware"],
		signals: [
			{
				label: "Membership model",
				detail:
					"Tenant memberships map Better Auth users to roles without leaking multi-tenant concepts into the merchant UI.",
				tone: "accent",
			},
		],
		timeline: [
			{
				title: "Bootstrap tenant + first admin",
				detail:
					"The installing merchant becomes the initial tenant admin when the Shopify app is first attached.",
				meta: "Plan 02",
			},
		],
		records: [
			{
				id: "tenant-1",
				domain: "northwind-demo.myshopify.com",
				role: "tenant_admin",
				status: "Healthy",
				tenant: "Northwind Atelier",
			},
			{
				id: "tenant-2",
				domain: "papertrail-co.myshopify.com",
				role: "tenant_member",
				status: "Needs bootstrap",
				tenant: "Papertrail Co.",
			},
		],
	},
	"sync-jobs": {
		eyebrow: "Queue health",
		title: "Sync jobs",
		summary:
			"Backfills, reconciliation jobs, projection rebuilds, and cleanup tasks will all report here with deterministic idempotent state.",
		chips: ["Convex workflows", "Bulk import", "Reconciliation"],
		signals: [
			{
				label: "Idempotency",
				detail:
					"Every webhook or bulk import path is designed to upsert by stable Shopify identifiers rather than append blindly.",
				tone: "success",
			},
		],
		timeline: [
			{
				title: "Split full import by domain",
				detail:
					"Products, collections, customers, orders, and inventory will each own their own retryable workflow.",
				meta: "Plan 04",
			},
		],
		records: [
			{
				id: "job-1",
				domain: "Products",
				status: "Running",
				tenant: "Northwind Atelier",
				updated_at: "2m ago",
			},
			{
				id: "job-2",
				domain: "Inventory",
				status: "Queued",
				tenant: "Papertrail Co.",
				updated_at: "11m ago",
			},
		],
	},
	webhooks: {
		eyebrow: "Ingress",
		title: "Webhook deliveries",
		summary:
			"Shopify webhook ingestion will be fully owned by Convex HTTP actions, with retained raw payloads and diagnostics.",
		chips: ["HTTP actions", "Retained payloads", "Replay safe"],
		signals: [
			{
				label: "Delivery logs",
				detail:
					"Topic, shop, event identity, and processing result will be stored for replay diagnostics and auditability.",
				tone: "neutral",
			},
		],
		timeline: [
			{
				title: "Register required webhook topics",
				detail:
					"Install flow will immediately provision app/uninstalled, products, collections, customers, orders, and inventory topics.",
				meta: "Plan 03",
			},
		],
		records: [
			{
				id: "webhook-1",
				latency: "184ms",
				shop: "northwind-demo.myshopify.com",
				status: "Processed",
				topic: "products/update",
			},
			{
				id: "webhook-2",
				latency: "592ms",
				shop: "papertrail-co.myshopify.com",
				status: "Retrying",
				topic: "inventory_levels/update",
			},
		],
	},
	"ai-traces": {
		eyebrow: "AI governance",
		title: "AI traces",
		summary:
			"Separate prompt and tool surfaces for shoppers and merchants eventually flow into a common internal trace view here.",
		chips: ["Prompt splits", "Approval audit", "Safety review"],
		signals: [
			{
				label: "Surface separation",
				detail:
					"Public shopper prompts and merchant prompts stay isolated by tool scope, approval policy, and rate limits.",
				tone: "accent",
			},
		],
		timeline: [
			{
				title: "Persist approved actions",
				detail:
					"Every merchant write proposal will record approver, inputs, outputs, and resulting Shopify mutation.",
				meta: "Plan 06",
			},
		],
		records: [
			{
				id: "trace-1",
				actor: "merchant",
				outcome: "Approval required",
				tenant: "Northwind Atelier",
				trace: "copilot-024",
			},
			{
				id: "trace-2",
				actor: "shopper",
				outcome: "Read only",
				tenant: "Papertrail Co.",
				trace: "storefront-117",
			},
		],
	},
};

export const marketingSnapshot = query({
	args: {},
	handler: async () => marketingSnapshotData,
});

export const installGuide = query({
	args: {},
	handler: async () => installGuideData,
});

export const merchantOverview = query({
	args: {},
	handler: async () => merchantOverviewData,
});

export const merchantModule = query({
	args: {
		module: v.union(
			v.literal("copilot"),
			v.literal("explorer"),
			v.literal("workflows"),
			v.literal("settings"),
		),
	},
	handler: async (_ctx, args) => merchantModules[args.module],
});

export const opsOverview = query({
	args: {},
	handler: async () => opsOverviewData,
});

export const opsModule = query({
	args: {
		module: v.union(
			v.literal("tenants"),
			v.literal("sync-jobs"),
			v.literal("webhooks"),
			v.literal("ai-traces"),
		),
	},
	handler: async (_ctx, args) => opsModules[args.module],
});
