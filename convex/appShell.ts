import { v } from "convex/values";
import type {
	InstallGuideSnapshot,
	InternalOverviewSnapshot,
	MarketingSnapshot,
	MerchantOverviewSnapshot,
	ModuleSnapshot,
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
			hint: "Marketing, embedded merchant app, and a dev-only internal console are all represented in the foundation.",
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
		"Initialize a shell-first embedded bootstrap so `/app` can render before App Bridge session tokens are attached to protected requests.",
		"Register Shopify install, OAuth, webhook, and storefront endpoints on Convex instead of the worker runtime.",
	],
	storefrontCallout:
		"The live storefront widget will ship as a theme app extension or app embed. It can answer catalog questions, guide cart building, and ground on approved knowledge without ever inheriting merchant admin permissions.",
};

const installGuideData: InstallGuideSnapshot = {
	title: "Install and bootstrap path",
	summary:
		"This slice keeps a lightweight preview cookie only for local demos. The embedded `/app` shell itself is already structured around shell-first App Bridge bootstrap instead of cookie-based auth.",
	checklist: [
		"Run Convex in anonymous agent mode locally or connect a real dev deployment.",
		"Use `/install` to enter merchant or internal preview mode.",
		"Refresh `/app` or `/internal` and confirm the first rendered frame already contains data.",
		"Replace the preview cookie bridge with verified Shopify session-token helpers in plan 02.",
	],
	notes: [
		{
			label: "Current bridge",
			detail:
				"Preview mode is intentionally temporary. It is only a local testing aid for merchant and internal shells, not the long-term embedded auth model.",
			tone: "watch",
		},
		{
			label: "Next auth step",
			detail:
				"App Bridge session tokens and token exchange will resolve the active shop and merchant actor without introducing a separate browser login.",
			tone: "accent",
		},
	],
};

const merchantOverviewData: MerchantOverviewSnapshot = {
	title: "Northwind Atelier",
	summary:
		"Shell-first merchant surface with preloaded overview metrics. This route is the concrete proof of the no-spinner first-load pattern in the foundation plan.",
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
			label: "Embedded shell bootstrap",
			detail:
				"Merchant routes can render a lightweight shell before App Bridge-backed requests kick in, so navigation avoids document redirects and blank states.",
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
			title: "Wire Shopify session bootstrap",
			detail:
				"Acquire session tokens from App Bridge, verify them in Convex, and resolve the active merchant actor for protected reads and writes.",
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
		chips: ["Approval gated", "Shop scoped", "Audit ready"],
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
					"You are the merchant copilot. Stay shop-scoped, request approval before mutations, and log all proposed actions.",
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
					"This page will surface extension status, public AI enablement, and install diagnostics without sending merchants into the internal console.",
				tone: "neutral",
			},
		],
		timeline: [
			{
				title: "Persist merchant controls",
				detail:
					"Replace the local preview form with authenticated Convex mutations once Shopify session verification and shop checks are in place.",
				meta: "Plan 02/03",
			},
		],
	},
};

const internalOverviewData: InternalOverviewSnapshot = {
	title: "Internal diagnostics",
	summary:
		"Dev-only shell for install state, webhook posture, cache projections, and action audits while the product is still being built.",
	metrics: [
		{
			label: "Install state",
			value: "1 shop",
			delta: "Preview ready",
			hint: "The internal console is single-store diagnostics, not a cross-tenant platform surface.",
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
			hint: "Action traces will help debug merchant copilot safety and approval flow behavior.",
			tone: "success",
		},
	],
	signals: [
		{
			label: "Environment gate",
			detail:
				"The route stays disabled unless internal tools are enabled, and it remains separate from merchant navigation in every environment.",
			tone: "success",
		},
		{
			label: "Single-store scope",
			detail:
				"These diagnostics inspect one connected shop and its app state, not a multi-tenant control plane.",
			tone: "neutral",
		},
	],
	timeline: [
		{
			title: "Stand up install audit trail",
			detail: "Track install, reinstall, scope changes, and bootstrap failures in Convex.",
			meta: "Plan 02/03",
		},
		{
			title: "Expose cache diagnostics",
			detail:
				"Bring sync freshness, replay helpers, and audit visibility into `/internal` while leaving merchant-facing settings focused on shop operations.",
			meta: "Plan 04",
		},
	],
};

const internalModules: Record<
	"install-state" | "cache" | "webhooks" | "action-audits",
	ModuleSnapshot
> = {
	"install-state": {
		eyebrow: "Install diagnostics",
		title: "Install state",
		summary:
			"Local view of install metadata, preview auth state, and shell bootstrap checkpoints while the real Shopify app install flow is still being wired.",
		chips: ["Dev only", "Install aware", "Auth traces"],
		signals: [
			{
				label: "Embedded auth",
				detail:
					"Session tokens authenticate embedded requests, while stored offline tokens later authorize backend Shopify calls.",
				tone: "accent",
			},
		],
		timeline: [
			{
				title: "Persist installation record",
				detail:
					"Store scopes, install status, and offline token metadata per shop once managed installation is connected.",
				meta: "Plan 02/03",
			},
		],
		records: [
			{
				id: "install-1",
				bootstrap: "Shell ready",
				install_status: "Preview",
				scopes: "read_products, read_orders",
				status: "Healthy",
				shop: "northwind-demo.myshopify.com",
			},
		],
	},
	cache: {
		eyebrow: "Projection cache",
		title: "Projection cache",
		summary:
			"Snapshot of mirrored products, inventory projections, and sync freshness for debugging before merchant-facing dashboards depend on them.",
		chips: ["Convex cache", "Sync freshness", "Replay safe"],
		signals: [
			{
				label: "Selective mirrors",
				detail:
					"Only the data needed for AI, diagnostics, and repeated reads should be mirrored into Convex.",
				tone: "success",
			},
		],
		timeline: [
			{
				title: "Backfill products and inventory",
				detail:
					"Warehouse mirrors should project products, inventory, orders, and collections into deterministic shop-scoped tables.",
				meta: "Plan 04",
			},
		],
		records: [
			{
				id: "cache-1",
				freshness: "2m",
				projection: "Products",
				rows: "4.2k",
				status: "Healthy",
			},
			{
				id: "cache-2",
				freshness: "11m",
				projection: "Inventory",
				rows: "18.4k",
				status: "Needs replay",
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
				shop: "northwind-demo.myshopify.com",
				status: "Retrying",
				topic: "inventory_levels/update",
			},
		],
	},
	"action-audits": {
		eyebrow: "Action audits",
		title: "Action audits",
		summary:
			"Merchant tool proposals, approvals, and executed mutations flow here for debugging and review.",
		chips: ["Approval trail", "Tool proposals", "Safety review"],
		signals: [
			{
				label: "Approval boundary",
				detail: "Merchant writes stay explicit and audited, while shopper AI remains read-only.",
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
				shop: "northwind-demo.myshopify.com",
				trace: "copilot-024",
			},
			{
				id: "trace-2",
				actor: "shopper",
				outcome: "Read only",
				shop: "northwind-demo.myshopify.com",
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

export const internalOverview = query({
	args: {},
	handler: async () => internalOverviewData,
});

export const internalModule = query({
	args: {
		module: v.union(
			v.literal("install-state"),
			v.literal("cache"),
			v.literal("webhooks"),
			v.literal("action-audits"),
		),
	},
	handler: async (_ctx, args) => internalModules[args.module],
});
