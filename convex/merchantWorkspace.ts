import { components, internal } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import {
	action,
	internalAction,
	internalMutation,
	internalQuery,
	mutation,
	query,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx,
} from "@convex/_generated/server";
import {
	parseInternalAdminMerchantUserId,
	requireMerchantActor,
	requireMerchantClaims,
	type MerchantActorRecord,
} from "@convex/auth";
import { runMerchantCopilotTurn } from "@convex/merchantCopilotRuntime";
import { resolveUsableInstallationAccessToken } from "@convex/shopify";
import { getShopifyAccessFailureReason } from "@convex/shopifyAccess";
import { shopifyAdminGraphqlRequest } from "@convex/shopifyAdmin";
import { v } from "convex/values";
import {
	dashboardSpecSchema,
	type MerchantApprovalCard,
	type MerchantCitation,
	type MerchantCopilotConversation,
	type MerchantCopilotSessionsData,
	type MerchantCopilotSessionSummary,
	type MerchantExplorerDataset,
	type MerchantExplorerDatasetKey,
	type MerchantDocumentRecord,
	type MerchantExplorerData,
	type MerchantOverviewData,
	type MerchantWorkflowLog,
	type MerchantWorkflowRecord,
	type MerchantWorkflowsData,
} from "@/shared/contracts/merchant-workspace";

const DEFAULT_CONVERSATION_TITLE = "Merchant copilot";
const DEFAULT_ORDER_WINDOW_DAYS = 30;
const DEFAULT_SALES_TREND_DAYS = 14;
const LOW_STOCK_THRESHOLD = 8;
const COPILOT_MESSAGE_LIMIT = 40;
const DOCUMENT_PREVIEW_LIMIT = 320;
const DOCUMENT_SUMMARY_LIMIT = 220;
const EXPLORER_RECORD_LIMIT = 25;
const OVERVIEW_PENDING_APPROVAL_LIMIT = 6;
const OVERVIEW_WORKFLOW_LOG_LIMIT = 4;
const OVERVIEW_WORKFLOW_RECORD_LIMIT = 6;
const PENDING_APPROVAL_SCAN_LIMIT = 128;
const WORKFLOW_LOG_LIMIT = 8;
const WORKFLOW_RECORD_LIMIT = 20;

const WORKFLOW_TYPE_LABELS: Record<string, string> = {
	catalog_index_rebuild: "Catalog index rebuild",
	dashboard_regeneration: "Dashboard regeneration",
	document_reindex: "Document re-index",
	metrics_cache_refresh: "Metrics cache refresh",
	reconciliation_scan: "Sync reconciliation scan",
	shop_uninstall_cleanup: "Shop uninstall cleanup",
};

const QUICK_PROMPTS = [
	"Show me the dashboard for the last two weeks.",
	"What products are closest to stocking out right now?",
	"Search my uploaded documents for the returns SOP.",
	"Use my uploaded playbooks to guide a reorder workflow for a low-stock SKU.",
	'Draft an approval to pause product "Unicorn Sparkle Backpack".',
];

const EXPLORER_DATASET_META: Record<
	MerchantExplorerDatasetKey,
	{
		description: string;
		title: string;
	}
> = {
	audit_logs: {
		description: "Recent merchant audit trail for approvals and operational actions.",
		title: "Audit log",
	},
	documents: {
		description: "Uploaded merchant-private and public knowledge records.",
		title: "Documents",
	},
	inventory: {
		description: "Variant inventory view focused on low-stock operational review.",
		title: "Inventory",
	},
	orders: {
		description: "Recent order window aligned with the take-home demo scope.",
		title: "Orders",
	},
	products: {
		description: "Current product search surface backed by the cached Shopify catalog projection.",
		title: "Products",
	},
};

const MERCHANT_OVERVIEW_QUERY = `
	query MerchantOverview($recentOrdersQuery: String!) {
		activeProductsCount: productsCount(query: "status:active", limit: 10000) {
			count
		}
		productsCount(limit: 10000) {
			count
		}
		collectionsCount(limit: 10000) {
			count
		}
		locationsCount(limit: 10000) {
			count
		}
		recentOrdersCount: ordersCount(query: $recentOrdersQuery, limit: 10000) {
			count
		}
		recentOrders: orders(first: 25, reverse: true, sortKey: PROCESSED_AT, query: $recentOrdersQuery) {
			nodes {
				id
				name
				processedAt
				displayFinancialStatus
				displayFulfillmentStatus
				currentTotalPriceSet {
					shopMoney {
						amount
						currencyCode
					}
				}
				lineItems(first: 25) {
					nodes {
						id
						quantity
						title
						variantTitle
						discountedTotalSet {
							shopMoney {
								amount
								currencyCode
							}
						}
						product {
							id
							handle
							title
						}
					}
				}
			}
		}
		lowStockProducts: products(first: 20, reverse: true, sortKey: UPDATED_AT, query: "status:active") {
			nodes {
				id
				title
				handle
				status
				tags
				variants(first: 20) {
					nodes {
						id
						title
						sku
						inventoryQuantity
						inventoryItem {
							id
							sku
						}
					}
				}
			}
		}
	}
`;

const SEARCH_PRODUCTS_QUERY = `
	query SearchProducts($query: String!) {
		products(first: 25, reverse: true, sortKey: UPDATED_AT, query: $query) {
			nodes {
				id
				title
				handle
				status
				vendor
				productType
				tags
				updatedAt
				onlineStoreUrl
				seo {
					title
					description
				}
				description(truncateAt: 220)
				variants(first: 10) {
					nodes {
						id
						title
						sku
						price
						inventoryQuantity
						inventoryItem {
							id
							sku
							tracked
						}
					}
				}
			}
		}
	}
`;

const SEARCH_ORDERS_QUERY = `
	query SearchOrders($query: String!) {
		orders(first: 25, reverse: true, sortKey: PROCESSED_AT, query: $query) {
			nodes {
				id
				name
				processedAt
				displayFinancialStatus
				displayFulfillmentStatus
				currentTotalPriceSet {
					shopMoney {
						amount
						currencyCode
					}
				}
			}
		}
	}
`;

const PRODUCT_EDIT_CONTEXT_QUERY = `
	query ProductEditContext($id: ID!) {
		product(id: $id) {
			id
			title
			handle
			descriptionHtml
			status
			tags
			vendor
			productType
			seo {
				title
				description
			}
			metafields(first: 10) {
				nodes {
					id
					namespace
					key
					type
					value
					compareDigest
				}
			}
			variants(first: 10) {
				nodes {
					id
					title
					sku
					inventoryQuantity
					inventoryItem {
						id
						sku
						tracked
					}
				}
			}
		}
		locations(first: 10) {
			nodes {
				id
				name
				isActive
			}
		}
	}
`;

const PRODUCT_UPDATE_MUTATION = `
	mutation UpdateProduct($product: ProductUpdateInput!) {
		productUpdate(product: $product) {
			product {
				id
				title
				handle
				status
				tags
			}
			userErrors {
				field
				message
			}
		}
	}
`;

const TAGS_ADD_MUTATION = `
	mutation AddTags($id: ID!, $tags: [String!]!) {
		tagsAdd(id: $id, tags: $tags) {
			node {
				id
			}
			userErrors {
				message
			}
		}
	}
`;

const TAGS_REMOVE_MUTATION = `
	mutation RemoveTags($id: ID!, $tags: [String!]!) {
		tagsRemove(id: $id, tags: $tags) {
			node {
				id
			}
			userErrors {
				message
			}
		}
	}
`;

const METAFIELDS_SET_MUTATION = `
	mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
		metafieldsSet(metafields: $metafields) {
			metafields {
				namespace
				key
				value
				updatedAt
			}
			userErrors {
				field
				message
				code
			}
		}
	}
`;

const INVENTORY_ADJUST_MUTATION = `
	mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
		inventoryAdjustQuantities(input: $input) {
			inventoryAdjustmentGroup {
				createdAt
				reason
				referenceDocumentUri
				changes {
					name
					delta
				}
			}
			userErrors {
				field
				message
			}
		}
	}
`;

type MoneyBag = {
	shopMoney?: {
		amount?: string | null;
		currencyCode?: string | null;
	} | null;
};

type ProductSearchNode = {
	description?: string | null;
	handle?: string | null;
	id?: string | null;
	onlineStoreUrl?: string | null;
	productType?: string | null;
	seo?: {
		description?: string | null;
		title?: string | null;
	} | null;
	status?: string | null;
	tags?: string[] | null;
	title?: string | null;
	updatedAt?: string | null;
	variants?: {
		nodes?: Array<{
			id?: string | null;
			inventoryItem?: {
				id?: string | null;
				sku?: string | null;
				tracked?: boolean | null;
			} | null;
			inventoryQuantity?: number | null;
			price?: string | null;
			sku?: string | null;
			title?: string | null;
		}> | null;
	} | null;
	vendor?: string | null;
};

type OrderNode = {
	currentTotalPriceSet?: MoneyBag | null;
	displayFinancialStatus?: string | null;
	displayFulfillmentStatus?: string | null;
	id?: string | null;
	lineItems?: {
		nodes?: Array<{
			discountedTotalSet?: MoneyBag | null;
			id?: string | null;
			product?: {
				handle?: string | null;
				id?: string | null;
				title?: string | null;
			} | null;
			quantity?: number | null;
			title?: string | null;
			variantTitle?: string | null;
		}> | null;
	} | null;
	name?: string | null;
	processedAt?: string | null;
};

type MerchantOverviewResponse = {
	activeProductsCount?: { count?: number | null } | null;
	collectionsCount?: { count?: number | null } | null;
	locationsCount?: { count?: number | null } | null;
	lowStockProducts?: {
		nodes?: ProductSearchNode[] | null;
	} | null;
	productsCount?: { count?: number | null } | null;
	recentOrders?: {
		nodes?: OrderNode[] | null;
	} | null;
	recentOrdersCount?: { count?: number | null } | null;
};

type ProductSearchResponse = {
	products?: {
		nodes?: ProductSearchNode[] | null;
	} | null;
};

type OrderSearchResponse = {
	orders?: {
		nodes?: OrderNode[] | null;
	} | null;
};

type ProductEditContextResponse = {
	locations?: {
		nodes?: Array<{
			id?: string | null;
			isActive?: boolean | null;
			name?: string | null;
		}> | null;
	} | null;
	product?: {
		descriptionHtml?: string | null;
		handle?: string | null;
		id?: string | null;
		metafields?: {
			nodes?: Array<{
				compareDigest?: string | null;
				id?: string | null;
				key?: string | null;
				namespace?: string | null;
				type?: string | null;
				value?: string | null;
			}> | null;
		} | null;
		productType?: string | null;
		seo?: {
			description?: string | null;
			title?: string | null;
		} | null;
		status?: string | null;
		tags?: string[] | null;
		title?: string | null;
		variants?: {
			nodes?: Array<{
				id?: string | null;
				inventoryItem?: {
					id?: string | null;
					sku?: string | null;
					tracked?: boolean | null;
				} | null;
				inventoryQuantity?: number | null;
				sku?: string | null;
				title?: string | null;
			}> | null;
		} | null;
		vendor?: string | null;
	} | null;
};

type WorkflowRow = Doc<"syncJobs"> & {
	attemptCount?: number;
	payloadPreview?: string;
	resultSummary?: string;
	retryAt?: number;
	retryCount?: number;
	source?: string;
};

type ApprovalPayload =
	| {
			mode: "add" | "remove";
			productId: string;
			productTitle: string;
			tags: string[];
			tool: "updateProductTags";
	  }
	| {
			descriptionHtml?: string;
			productId: string;
			productTitle: string;
			title?: string;
			tool: "updateProductContent";
	  }
	| {
			locationId: string;
			locationName: string;
			productTitle: string;
			reason: string;
			referenceDocumentUri: string;
			tool: "adjustInventory";
			variantId: string;
			variantInventoryItemId: string;
			variantTitle: string;
			delta: number;
	  }
	| {
			metafields: Array<{
				compareDigest?: string | null;
				key: string;
				namespace?: string;
				type?: string;
				value: string;
			}>;
			productId: string;
			productTitle: string;
			tool: "updateProductMetafields";
	  }
	| {
			productId: string;
			productTitle: string;
			status: "ACTIVE" | "ARCHIVED" | "DRAFT";
			tool: "updateProductStatus";
	  }
	| {
			productId: string;
			productTitle: string;
			workflowType: string;
			tool: "enqueueWorkflow";
	  };

interface BetterAuthMemberSnapshot {
	_id?: string;
	id: string;
	initials?: string | null;
	lastAuthenticatedAt?: number | null;
	organizationId: string;
	role: string;
	sessionId?: string | null;
	shopifyUserId: string;
	userId: string;
}

interface BetterAuthOrganizationSnapshot {
	_id?: string;
	id: string;
	shopDomain: string;
	shopId: string;
}

interface BetterAuthUserSnapshot {
	_id?: string;
	email: string;
	id: string;
	name: string;
}

function formatIso(value: number | null | undefined) {
	return value ? new Date(value).toISOString() : null;
}

function formatFromString(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	const date = new Date(value);

	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseAmount(value: string | null | undefined) {
	if (!value) {
		return 0;
	}

	const amount = Number.parseFloat(value);

	return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(amount: number, currencyCode: string | null | undefined) {
	return new Intl.NumberFormat("en-US", {
		currency: currencyCode ?? "USD",
		style: "currency",
	}).format(amount);
}

function compactNumber(value: number) {
	return new Intl.NumberFormat("en-US", {
		maximumFractionDigits: value >= 100 ? 0 : 1,
		notation: "compact",
	}).format(value);
}

function getInitials(name: string) {
	const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

	if (words.length === 0) {
		return "SA";
	}

	return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

function getAuthRecordId(record: { _id?: string; id?: string }) {
	return record.id ?? record._id ?? "";
}

function normalizeText(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

function previewText(value: string, limit = DOCUMENT_PREVIEW_LIMIT) {
	return normalizeText(value).slice(0, limit);
}

function summarizeDocument(value: string) {
	const normalized = normalizeText(value);

	if (normalized.length <= DOCUMENT_SUMMARY_LIMIT) {
		return normalized;
	}

	const sentences = normalized
		.split(/(?<=[.!?])\s+/)
		.slice(0, 2)
		.join(" ");

	return sentences.length > 0
		? sentences.slice(0, DOCUMENT_SUMMARY_LIMIT)
		: normalized.slice(0, DOCUMENT_SUMMARY_LIMIT);
}

function parseJson<T>(value: string | null | undefined, fallback: T) {
	if (!value) {
		return fallback;
	}

	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function parseDashboardSpec(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	try {
		return dashboardSpecSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}

function formatWorkflowTitle(type: string) {
	return WORKFLOW_TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

function workflowTone(level: string): MerchantWorkflowLog["level"] {
	if (level === "error") {
		return "error";
	}

	if (level === "success") {
		return "success";
	}

	if (level === "watch") {
		return "watch";
	}

	return "info";
}

function approvalStatusTone(
	status: Doc<"merchantActionApprovals">["status"],
): MerchantApprovalCard["status"] {
	if (
		status === "approved" ||
		status === "executing" ||
		status === "failed" ||
		status === "pending" ||
		status === "rejected"
	) {
		return status;
	}

	return "pending";
}

function searchTextForDocument(document: { content: string; fileName?: string; title: string }) {
	return [document.title, document.fileName, document.content].filter(Boolean).join(" ");
}

function recentOrdersQuery(days = DEFAULT_ORDER_WINDOW_DAYS) {
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
	return `processed_at:>=${since}`;
}

function buildOrderSearchQuery(args: { query?: string | null; windowDays?: number | null }) {
	return [recentOrdersQuery(args.windowDays ?? DEFAULT_ORDER_WINDOW_DAYS), args.query?.trim()]
		.filter((value): value is string => Boolean(value))
		.join(" ");
}

function buildDefaultDashboard(input: {
	activeProducts: number;
	citations: MerchantCitation[];
	documentCount: number;
	lowStockCount: number;
	lowStockRows: Array<Record<string, string | number | null>>;
	orderCount: number;
	pendingApprovalCount: number;
	revenueCurrency: string | null;
	revenueTotal: number;
	salesTrend: Array<{ label: string; value: number }>;
	topProducts: Array<{ label: string; value: number }>;
}) {
	const spec = dashboardSpecSchema.parse({
		cards: [
			{
				description: "Gross revenue across the recent retained demo-order window.",
				id: "revenue",
				tone: input.revenueTotal > 0 ? "success" : "watch",
				type: "metric",
				value: formatMoney(input.revenueTotal, input.revenueCurrency),
				valueLabel: "Revenue window",
			},
			{
				description: "Orders in the same recent demo window used by the merchant copilot.",
				id: "orders",
				tone: input.orderCount > 0 ? "accent" : "watch",
				type: "metric",
				value: compactNumber(input.orderCount),
				valueLabel: "Recent orders",
			},
			{
				description: "Published products currently visible to the merchant surface.",
				id: "products",
				tone: input.activeProducts > 0 ? "success" : "watch",
				type: "metric",
				value: compactNumber(input.activeProducts),
				valueLabel: "Active products",
			},
			{
				description: "Operational items waiting on a human decision.",
				id: "approvals",
				tone: input.pendingApprovalCount > 0 ? "watch" : "neutral",
				type: "metric",
				value: compactNumber(input.pendingApprovalCount),
				valueLabel: "Pending approvals",
			},
			{
				description: "Daily revenue trend from recent demo orders.",
				id: "sales-trend",
				points: input.salesTrend,
				seriesLabel: "Revenue",
				type: "line_chart",
			},
			{
				description: "Top-selling products by recent line-item revenue.",
				id: "top-products",
				points: input.topProducts,
				seriesLabel: "Revenue",
				type: "bar_chart",
			},
			{
				columns: ["product", "variant", "inventory", "sku"],
				description: "Variants at or below the working low-stock threshold.",
				id: "low-stock",
				rows: input.lowStockRows,
				type: "table",
			},
			{
				bullets: [
					`${input.lowStockCount} low-stock variant(s) need review.`,
					`${input.documentCount} merchant document(s) are available for grounding.`,
					`${input.citations.length} source bucket(s) are currently feeding this dashboard.`,
				],
				description: "Default operational summary built without an AI-generated layout.",
				id: "insight",
				tone: input.lowStockCount > 0 ? "watch" : "neutral",
				type: "insight",
			},
		],
		description:
			"Deterministic overview built from Shopify Admin reads, Convex caches, and shop-private knowledge records.",
		generatedAt: new Date().toISOString(),
		title: "Merchant operating dashboard",
	});

	return spec;
}

function buildTrendPoints(orders: OrderNode[]) {
	const buckets = new Map<string, number>();

	for (let index = DEFAULT_SALES_TREND_DAYS - 1; index >= 0; index -= 1) {
		const date = new Date(Date.now() - index * 24 * 60 * 60 * 1000);
		const key = date.toISOString().slice(0, 10);
		buckets.set(key, 0);
	}

	for (const order of orders) {
		const key = order.processedAt?.slice(0, 10);

		if (!key || !buckets.has(key)) {
			continue;
		}

		buckets.set(
			key,
			(buckets.get(key) ?? 0) + parseAmount(order.currentTotalPriceSet?.shopMoney?.amount),
		);
	}

	return Array.from(buckets.entries()).map(([key, value]) => ({
		label: key.slice(5),
		value,
	}));
}

function buildTopProducts(orders: OrderNode[]) {
	const totals = new Map<string, number>();

	for (const order of orders) {
		for (const lineItem of order.lineItems?.nodes ?? []) {
			const label = lineItem.product?.title ?? lineItem.title ?? "Unknown product";
			const currentTotal = parseAmount(lineItem.discountedTotalSet?.shopMoney?.amount);
			totals.set(label, (totals.get(label) ?? 0) + currentTotal);
		}
	}

	return Array.from(totals.entries())
		.sort((left, right) => right[1] - left[1])
		.slice(0, 6)
		.map(([label, value]) => ({
			label,
			value,
		}));
}

function buildLowStockRows(products: ProductSearchNode[]) {
	const rows: Array<Record<string, string | number | null>> = [];

	for (const product of products) {
		for (const variant of product.variants?.nodes ?? []) {
			const inventory = variant.inventoryQuantity ?? 0;

			if (inventory > LOW_STOCK_THRESHOLD) {
				continue;
			}

			rows.push({
				inventory,
				product: product.title ?? "Untitled product",
				sku: variant.sku ?? variant.inventoryItem?.sku ?? null,
				variant: variant.title ?? "Default",
			});
		}
	}

	return rows
		.sort((left, right) => Number(left.inventory ?? 0) - Number(right.inventory ?? 0))
		.slice(0, 8);
}

function toDocumentRecord(document: Doc<"merchantDocuments">): MerchantDocumentRecord {
	return {
		chunkCount: document.chunkCount ?? null,
		contentPreview: document.contentPreview,
		failureReason: document.failureReason ?? null,
		fileName: document.fileName ?? null,
		id: document._id,
		sourceType: document.sourceType,
		status: document.status,
		summary: document.summary,
		title: document.title,
		updatedAt: new Date(document.updatedAt).toISOString(),
		visibility: document.visibility,
	};
}

function toApprovalCard(approval: Doc<"merchantActionApprovals">): MerchantApprovalCard {
	return {
		decidedAt: formatIso(approval.decidedAt),
		errorMessage: approval.errorMessage ?? null,
		id: approval._id,
		plannedChanges: parseJson(
			approval.plannedChangesJson,
			[] as MerchantApprovalCard["plannedChanges"],
		),
		requestedAt: new Date(approval.requestedAt).toISOString(),
		resultSummary: approval.resultSummary ?? null,
		riskSummary: approval.riskSummary,
		status: approvalStatusTone(approval.status),
		summary: approval.summary,
		targetLabel: approval.targetLabel,
		targetShopDomain: approval.shopDomain,
		targetType: approval.targetType,
		tool: approval.tool,
	};
}

async function getRuntimeState(
	ctx: QueryCtx,
	args: {
		actorId: string;
		shopDomain: string;
		shopId: Id<"shops">;
	},
) {
	const shop = await ctx.db.get(args.shopId);

	if (!shop || shop.domain !== args.shopDomain) {
		throw new Error("Authenticated shop could not be resolved.");
	}

	const installation = await ctx.db
		.query("shopifyInstallations")
		.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
		.unique();
	const internalAdminUserId = parseInternalAdminMerchantUserId(args.actorId);

	if (internalAdminUserId) {
		const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: "user",
			where: [
				{
					field: "_id",
					value: internalAdminUserId,
				},
			],
		})) as BetterAuthUserSnapshot | null;

		if (!user) {
			throw new Error("Authenticated Better Auth user could not be resolved.");
		}

		return {
			actor: {
				email: user.email,
				id: args.actorId,
				initials: getInitials(user.name),
				lastAuthenticatedAt: shop.lastAuthenticatedAt ?? null,
				name: user.name,
				organizationId: `internal-admin-org:${shop._id}`,
				role: "admin",
				sessionId: null,
				shopDomain: shop.domain,
				shopId: shop._id,
				shopifyUserId: `internal-admin:${getAuthRecordId(user)}`,
				userId: getAuthRecordId(user),
			} satisfies MerchantActorRecord,
			installation,
			shop,
		};
	}

	const member = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: "member",
		where: [
			{
				field: "_id",
				value: args.actorId,
			},
		],
	})) as BetterAuthMemberSnapshot | null;

	if (!member) {
		throw new Error("Authenticated merchant member could not be resolved.");
	}

	const organization = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: "organization",
		where: [
			{
				field: "_id",
				value: member.organizationId,
			},
		],
	})) as BetterAuthOrganizationSnapshot | null;

	if (
		!organization ||
		organization.shopId !== args.shopId ||
		organization.shopDomain !== args.shopDomain
	) {
		throw new Error("Authenticated merchant organization could not be resolved.");
	}

	const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: "user",
		where: [
			{
				field: "_id",
				value: member.userId,
			},
		],
	})) as BetterAuthUserSnapshot | null;

	if (!user) {
		throw new Error("Authenticated Better Auth user could not be resolved.");
	}

	return {
		actor: {
			email: user.email,
			id: getAuthRecordId(member),
			initials: member.initials ?? getInitials(user.name),
			lastAuthenticatedAt: member.lastAuthenticatedAt ?? null,
			name: user.name,
			organizationId: member.organizationId,
			role: member.role,
			sessionId: member.sessionId ?? null,
			shopDomain: shop.domain,
			shopId: shop._id,
			shopifyUserId: member.shopifyUserId,
			userId: getAuthRecordId(user),
		} satisfies MerchantActorRecord,
		installation,
		shop,
	};
}

async function listConversationMessages(
	ctx: QueryCtx,
	options: {
		conversationId: Id<"merchantCopilotConversations">;
	},
) {
	const rows = await ctx.db
		.query("merchantCopilotMessages")
		.withIndex("by_conversation_and_created_at", (query) =>
			query.eq("conversationId", options.conversationId),
		)
		.order("desc")
		.take(COPILOT_MESSAGE_LIMIT);

	return rows.reverse();
}

async function getLatestConversation(
	ctx: QueryCtx,
	options: {
		actorId: string;
		shopId: Id<"shops">;
	},
) {
	const rows = await ctx.db
		.query("merchantCopilotConversations")
		.withIndex("by_shop_and_actor_and_updated_at", (query) =>
			query.eq("shopId", options.shopId).eq("actorId", options.actorId),
		)
		.order("desc")
		.take(1);

	return rows[0] ?? null;
}

async function listCopilotConversations(
	ctx: QueryCtx,
	options: {
		actorId: string;
		shopId: Id<"shops">;
	},
) {
	return await ctx.db
		.query("merchantCopilotConversations")
		.withIndex("by_shop_and_actor_and_updated_at", (query) =>
			query.eq("shopId", options.shopId).eq("actorId", options.actorId),
		)
		.order("desc")
		.take(25);
}

async function listPendingApprovalsByShop(
	ctx: QueryCtx,
	options: {
		limit: number;
		shopId: Id<"shops">;
	},
) {
	const [executingApprovals, pendingApprovals] = await Promise.all([
		ctx.db
			.query("merchantActionApprovals")
			.withIndex("by_shop_and_status_and_requested_at", (query) =>
				query.eq("shopId", options.shopId).eq("status", "executing"),
			)
			.order("desc")
			.take(PENDING_APPROVAL_SCAN_LIMIT),
		ctx.db
			.query("merchantActionApprovals")
			.withIndex("by_shop_and_status_and_requested_at", (query) =>
				query.eq("shopId", options.shopId).eq("status", "pending"),
			)
			.order("desc")
			.take(PENDING_APPROVAL_SCAN_LIMIT),
	]);

	return [...pendingApprovals, ...executingApprovals]
		.sort((left, right) => right.requestedAt - left.requestedAt)
		.slice(0, options.limit);
}

async function buildPendingApprovalCountByConversation(
	ctx: QueryCtx,
	options: {
		conversationIds: readonly Id<"merchantCopilotConversations">[];
		shopId: Id<"shops">;
	},
) {
	if (options.conversationIds.length === 0) {
		return new Map<Id<"merchantCopilotConversations">, number>();
	}

	const counts = new Map<Id<"merchantCopilotConversations">, number>();
	for (const conversationId of options.conversationIds) {
		counts.set(conversationId, 0);
	}
	const approvals = await listPendingApprovalsByShop(ctx, {
		limit: PENDING_APPROVAL_SCAN_LIMIT,
		shopId: options.shopId,
	});

	for (const approval of approvals) {
		if (!approval.conversationId || !counts.has(approval.conversationId)) {
			continue;
		}

		counts.set(approval.conversationId, (counts.get(approval.conversationId) ?? 0) + 1);
	}

	return counts;
}

async function listCopilotSessionSummaries(
	ctx: QueryCtx,
	options: {
		actorId: string;
		shopId: Id<"shops">;
	},
): Promise<MerchantCopilotSessionSummary[]> {
	const conversations = await listCopilotConversations(ctx, options);
	const pendingApprovalCountByConversation = await buildPendingApprovalCountByConversation(ctx, {
		conversationIds: conversations.map((conversation) => conversation._id),
		shopId: options.shopId,
	});

	return conversations.map((conversation) => ({
		conversationId: conversation._id,
		createdAt: new Date(conversation.createdAt).toISOString(),
		lastAssistantSummary: conversation.lastAssistantSummary ?? null,
		lastPromptPreview: conversation.lastPromptPreview ?? null,
		pendingApprovalCount: pendingApprovalCountByConversation.get(conversation._id) ?? 0,
		title: conversation.title,
		updatedAt: new Date(conversation.updatedAt).toISOString(),
	}));
}

async function loadConversationState(
	ctx: QueryCtx,
	options: {
		actorId: string;
		conversationId?: Id<"merchantCopilotConversations">;
		shopId: Id<"shops">;
	},
): Promise<MerchantCopilotConversation> {
	const conversation = options.conversationId
		? await ctx.db.get(options.conversationId)
		: await getLatestConversation(ctx, {
				actorId: options.actorId,
				shopId: options.shopId,
			});

	if (!conversation || conversation.shopId !== options.shopId) {
		return {
			conversationId: null,
			latestDashboard: null,
			messages: [],
			pendingApprovals: [],
			quickPrompts: QUICK_PROMPTS,
		};
	}

	if (conversation.actorId !== options.actorId) {
		return {
			conversationId: null,
			latestDashboard: null,
			messages: [],
			pendingApprovals: [],
			quickPrompts: QUICK_PROMPTS,
		};
	}

	const messages = await listConversationMessages(ctx, {
		conversationId: conversation._id,
	});
	const approvalIds = Array.from(new Set(messages.flatMap((message) => message.approvalIds ?? [])));
	const approvals = (
		await Promise.all(approvalIds.map((approvalId) => ctx.db.get(approvalId)))
	).filter((approval): approval is Doc<"merchantActionApprovals"> => Boolean(approval));
	const messageApprovalMap = new Map(
		approvals.map((approval) => [approval._id, toApprovalCard(approval)]),
	);
	const materializedMessages = messages.map((message) => ({
		approvals: (message.approvalIds ?? [])
			.map((approvalId) => messageApprovalMap.get(approvalId))
			.filter((approval): approval is MerchantApprovalCard => Boolean(approval)),
		body: message.body,
		citations: parseJson(message.citationsJson, [] as MerchantCitation[]),
		createdAt: new Date(message.createdAt).toISOString(),
		dashboard: parseDashboardSpec(message.dashboardSpecJson),
		id: message._id,
		role: message.role,
		toolNames: message.toolNames,
	}));
	const pendingApprovals = approvals
		.filter((approval) => approval.status === "pending" || approval.status === "executing")
		.map(toApprovalCard);
	const latestDashboard =
		[...materializedMessages].reverse().find((message) => message.dashboard !== null)?.dashboard ??
		null;

	return {
		conversationId: conversation._id,
		latestDashboard,
		messages: materializedMessages,
		pendingApprovals,
		quickPrompts: QUICK_PROMPTS,
	};
}

async function listDocumentsByShop(
	ctx: QueryCtx,
	options: {
		shopId: Id<"shops">;
	},
) {
	return await ctx.db
		.query("merchantDocuments")
		.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", options.shopId))
		.order("desc")
		.take(25);
}

async function searchDocumentsByShop(
	ctx: QueryCtx,
	options: {
		limit?: number;
		query?: string;
		shopId: Id<"shops">;
	},
) {
	const queryText = options.query?.trim() ?? "";
	const limit = Math.min(Math.max(options.limit ?? 6, 1), 10);

	if (queryText.length >= 2) {
		return await ctx.db
			.query("merchantDocuments")
			.withSearchIndex("search_text", (query) =>
				query.search("searchText", queryText).eq("shopId", options.shopId).eq("status", "ready"),
			)
			.take(limit);
	}

	return await ctx.db
		.query("merchantDocuments")
		.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", options.shopId))
		.order("desc")
		.take(limit);
}

async function listWorkflowRecords(
	ctx: QueryCtx,
	options: {
		logLimit?: number;
		recordLimit?: number;
		shopId: Id<"shops">;
	},
): Promise<MerchantWorkflowRecord[]> {
	const rows = (await ctx.db
		.query("syncJobs")
		.withIndex("by_shop_and_last_updated_at", (query) => query.eq("shopId", options.shopId))
		.order("desc")
		.take(options.recordLimit ?? WORKFLOW_RECORD_LIMIT)) as WorkflowRow[];

	return await Promise.all(
		rows.map(async (row) => {
			const logs = await ctx.db
				.query("workflowLogs")
				.withIndex("by_job_and_created_at", (query) => query.eq("jobId", row._id))
				.order("desc")
				.take(options.logLimit ?? WORKFLOW_LOG_LIMIT);

			return {
				cacheKey: row.cacheKey ?? null,
				completedAt: formatIso(row.completedAt),
				error: row.error ?? null,
				id: row._id,
				lastUpdatedAt: new Date(row.lastUpdatedAt).toISOString(),
				logs: logs
					.slice()
					.reverse()
					.map((log) => ({
						createdAt: new Date(log.createdAt).toISOString(),
						detail: log.detail ?? null,
						level: workflowTone(log.level),
						message: log.message,
					})),
				payloadPreview: row.payloadPreview ?? null,
				requestedAt: formatIso(row.requestedAt),
				resultSummary: row.resultSummary ?? null,
				retryAt: formatIso(row.retryAt),
				retryCount: row.retryCount ?? 0,
				source: row.source ?? null,
				startedAt: formatIso(row.startedAt),
				status: row.status,
				title: formatWorkflowTitle(row.type),
				type: row.type,
			};
		}),
	);
}

async function logWorkflowEvent(
	ctx: MutationCtx,
	args: {
		detail?: string;
		jobId: Id<"syncJobs">;
		level: "error" | "info" | "success" | "watch";
		message: string;
		shopId: Id<"shops">;
	},
) {
	await ctx.db.insert("workflowLogs", {
		createdAt: Date.now(),
		detail: args.detail,
		jobId: args.jobId,
		level: args.level,
		message: args.message,
		shopId: args.shopId,
	});
}

async function auditAction(
	ctx: MutationCtx,
	args: {
		action: string;
		actorId: string;
		detail: string;
		payload?: Record<string, unknown>;
		shopId: Id<"shops">;
		status: string;
	},
) {
	await ctx.db.insert("auditLogs", {
		action: args.action,
		actorId: args.actorId,
		createdAt: Date.now(),
		detail: args.detail,
		payload: args.payload,
		shopId: args.shopId,
		status: args.status,
	});
}

async function fetchShopifyOverview(args: {
	accessToken: string;
	shopDomain: string;
	windowDays?: number | null;
}): Promise<MerchantOverviewResponse> {
	return await shopifyAdminGraphqlRequest<MerchantOverviewResponse>({
		accessToken: args.accessToken,
		query: MERCHANT_OVERVIEW_QUERY,
		shop: args.shopDomain,
		variables: {
			recentOrdersQuery: recentOrdersQuery(args.windowDays ?? DEFAULT_ORDER_WINDOW_DAYS),
		},
	});
}

async function searchShopifyProducts(args: {
	accessToken: string;
	query: string;
	shopDomain: string;
}): Promise<ProductSearchNode[]> {
	const payload = await shopifyAdminGraphqlRequest<ProductSearchResponse>({
		accessToken: args.accessToken,
		query: SEARCH_PRODUCTS_QUERY,
		shop: args.shopDomain,
		variables: {
			query: args.query,
		},
	});

	return payload.products?.nodes ?? [];
}

async function searchShopifyOrders(args: {
	accessToken: string;
	query: string;
	shopDomain: string;
}): Promise<OrderNode[]> {
	const payload = await shopifyAdminGraphqlRequest<OrderSearchResponse>({
		accessToken: args.accessToken,
		query: SEARCH_ORDERS_QUERY,
		shop: args.shopDomain,
		variables: {
			query: args.query,
		},
	});

	return payload.orders?.nodes ?? [];
}

async function getProductEditContext(args: {
	accessToken: string;
	productId: string;
	shopDomain: string;
}) {
	return await shopifyAdminGraphqlRequest<ProductEditContextResponse>({
		accessToken: args.accessToken,
		query: PRODUCT_EDIT_CONTEXT_QUERY,
		shop: args.shopDomain,
		variables: {
			id: args.productId,
		},
	});
}

function buildShopifyCitation(label: string, detail: string): MerchantCitation {
	return {
		detail,
		href: null,
		label,
		sourceType: "shopify",
	};
}

function buildExplorerDataset(
	key: MerchantExplorerDatasetKey,
	rows: MerchantExplorerDataset["rows"],
): MerchantExplorerDataset {
	const meta = EXPLORER_DATASET_META[key];

	return {
		description: meta.description,
		key,
		rows,
		title: meta.title,
	};
}

function buildCatalogProductRows(rows: Doc<"shopifyCatalogProducts">[]) {
	return rows.map((row) => ({
		availability: row.availableForSale ? "available" : "unavailable",
		handle: row.handle,
		product_type: row.productType ?? null,
		status: row.sourceStatus,
		summary: row.summary,
		title: row.title,
		updated_at: new Date(row.sourceUpdatedAt).toISOString(),
		variant_count: row.variantTitles.length,
		vendor: row.vendor ?? null,
	}));
}

function buildInventoryRows(rows: ProductSearchNode[]) {
	const flattened = rows.flatMap((row) =>
		(row.variants?.nodes ?? []).map((variant) => ({
			inventory: variant.inventoryQuantity ?? 0,
			product: row.title ?? "Untitled product",
			sku: variant.sku ?? variant.inventoryItem?.sku ?? null,
			status: row.status ?? null,
			variant: variant.title ?? "Default",
		})),
	);

	return flattened
		.sort((left, right) => Number(left.inventory) - Number(right.inventory))
		.slice(0, 25);
}

function buildOrderRows(rows: OrderNode[]) {
	return rows.map((row) => ({
		financial_status: row.displayFinancialStatus ?? null,
		fulfillment_status: row.displayFulfillmentStatus ?? null,
		order: row.name ?? null,
		processed_at: formatFromString(row.processedAt) ?? row.processedAt ?? null,
		total: formatMoney(
			parseAmount(row.currentTotalPriceSet?.shopMoney?.amount),
			row.currentTotalPriceSet?.shopMoney?.currencyCode,
		),
	}));
}

function buildAuditRows(rows: Doc<"auditLogs">[]) {
	return rows.map((row) => ({
		action: row.action,
		created_at: new Date(row.createdAt).toISOString(),
		detail: row.detail ?? null,
		status: row.status ?? null,
	}));
}

export const getRuntimeStateInternal = internalQuery({
	args: {
		actorId: v.string(),
		shopDomain: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		return await getRuntimeState(ctx, args);
	},
});

export const getConversationStateInternal = internalQuery({
	args: {
		actorId: v.string(),
		conversationId: v.optional(v.id("merchantCopilotConversations")),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		return await loadConversationState(ctx, args);
	},
});

export const getConversationThreadState = internalQuery({
	args: {
		conversationId: v.id("merchantCopilotConversations"),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);

		if (!conversation) {
			return null;
		}

		return {
			conversationId: conversation._id,
			threadId: conversation.threadId ?? null,
		};
	},
});

export const getApprovalExecutionState = internalQuery({
	args: {
		approvalId: v.id("merchantActionApprovals"),
	},
	handler: async (ctx, args) => {
		const approval = await ctx.db.get(args.approvalId);

		if (!approval) {
			return null;
		}

		const runtime = await getRuntimeState(ctx, {
			actorId: approval.actorId,
			shopDomain: approval.shopDomain,
			shopId: approval.shopId,
		});

		return {
			actor: runtime.actor,
			approval,
			installation: runtime.installation,
			shop: runtime.shop,
		};
	},
});

export const appendCopilotMessage = internalMutation({
	args: {
		actorId: v.string(),
		approvalIds: v.optional(v.array(v.id("merchantActionApprovals"))),
		body: v.string(),
		citationsJson: v.optional(v.string()),
		conversationId: v.id("merchantCopilotConversations"),
		dashboardSpecJson: v.optional(v.string()),
		role: v.union(v.literal("assistant"), v.literal("system"), v.literal("user")),
		shopId: v.id("shops"),
		toolNames: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const messageId = await ctx.db.insert("merchantCopilotMessages", {
			actorId: args.actorId,
			approvalIds: args.approvalIds,
			body: args.body,
			citationsJson: args.citationsJson,
			conversationId: args.conversationId,
			createdAt: now,
			dashboardSpecJson: args.dashboardSpecJson,
			role: args.role,
			shopId: args.shopId,
			toolNames: args.toolNames,
		});
		const conversation = await ctx.db.get(args.conversationId);

		if (conversation) {
			await ctx.db.patch(conversation._id, {
				lastAssistantSummary:
					args.role === "assistant" ? args.body.slice(0, 180) : conversation.lastAssistantSummary,
				lastPromptPreview:
					args.role === "user" ? args.body.slice(0, 180) : conversation.lastPromptPreview,
				title:
					args.role === "user" && conversation.title === DEFAULT_CONVERSATION_TITLE
						? args.body.slice(0, 72)
						: conversation.title,
				updatedAt: now,
			});
		}

		return messageId;
	},
});

export const ensureConversation = internalMutation({
	args: {
		actorId: v.string(),
		promptPreview: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const existing = await getLatestConversation(ctx, {
			actorId: args.actorId,
			shopId: args.shopId,
		});
		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				lastPromptPreview: args.promptPreview,
				updatedAt: now,
			});
			return existing._id;
		}

		return await ctx.db.insert("merchantCopilotConversations", {
			actorId: args.actorId,
			createdAt: now,
			lastPromptPreview: args.promptPreview,
			shopId: args.shopId,
			threadId: undefined,
			title: DEFAULT_CONVERSATION_TITLE,
			updatedAt: now,
		});
	},
});

export const setConversationThread = internalMutation({
	args: {
		conversationId: v.id("merchantCopilotConversations"),
		threadId: v.string(),
	},
	handler: async (ctx, args) => {
		const conversation = await ctx.db.get(args.conversationId);

		if (!conversation) {
			return null;
		}

		await ctx.db.patch(conversation._id, {
			threadId: args.threadId,
			updatedAt: Date.now(),
		});

		return conversation._id;
	},
});

async function deleteConversationMessages(
	ctx: MutationCtx,
	options: {
		conversationId: Id<"merchantCopilotConversations">;
	},
) {
	while (true) {
		const rows = await ctx.db
			.query("merchantCopilotMessages")
			.withIndex("by_conversation_and_created_at", (query) =>
				query.eq("conversationId", options.conversationId),
			)
			.take(64);

		if (rows.length === 0) {
			break;
		}

		for (const row of rows) {
			await ctx.db.delete(row._id);
		}
	}
}

async function detachConversationApprovals(
	ctx: MutationCtx,
	options: {
		conversationId: Id<"merchantCopilotConversations">;
	},
) {
	while (true) {
		const rows = await ctx.db
			.query("merchantActionApprovals")
			.withIndex("by_conversation_and_requested_at", (query) =>
				query.eq("conversationId", options.conversationId),
			)
			.take(64);

		if (rows.length === 0) {
			break;
		}

		for (const row of rows) {
			await ctx.db.patch(row._id, {
				conversationId: undefined,
				updatedAt: Date.now(),
			});
		}
	}
}

export const createApprovalRequest = internalMutation({
	args: {
		actorId: v.string(),
		conversationId: v.id("merchantCopilotConversations"),
		plannedChangesJson: v.string(),
		requestPayload: v.any(),
		riskSummary: v.string(),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		summary: v.string(),
		targetId: v.optional(v.string()),
		targetLabel: v.string(),
		targetType: v.string(),
		tool: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const approvalId = await ctx.db.insert("merchantActionApprovals", {
			actorId: args.actorId,
			conversationId: args.conversationId,
			createdAt: now,
			plannedChangesJson: args.plannedChangesJson,
			requestPayload: args.requestPayload,
			requestedAt: now,
			riskSummary: args.riskSummary,
			shopDomain: args.shopDomain,
			shopId: args.shopId,
			status: "pending",
			summary: args.summary,
			targetId: args.targetId,
			targetLabel: args.targetLabel,
			targetType: args.targetType,
			tool: args.tool,
			updatedAt: now,
		});

		await auditAction(ctx, {
			action: `merchant.approval.${args.tool}.requested`,
			actorId: args.actorId,
			detail: args.summary,
			payload: {
				targetId: args.targetId,
				targetLabel: args.targetLabel,
				tool: args.tool,
			},
			shopId: args.shopId,
			status: "pending",
		});

		return approvalId;
	},
});

export const setApprovalState = internalMutation({
	args: {
		approvalId: v.id("merchantActionApprovals"),
		errorMessage: v.optional(v.string()),
		resultSummary: v.optional(v.string()),
		status: v.string(),
	},
	handler: async (ctx, args) => {
		const approval = await ctx.db.get(args.approvalId);

		if (!approval) {
			return null;
		}

		const now = Date.now();

		await ctx.db.patch(args.approvalId, {
			decidedAt:
				args.status === "approved" || args.status === "rejected" || args.status === "failed"
					? now
					: approval.decidedAt,
			errorMessage: args.errorMessage,
			resultSummary: args.resultSummary,
			status: args.status,
			updatedAt: now,
		});

		return approval._id;
	},
});

export const recordAuditLog = internalMutation({
	args: {
		action: v.string(),
		actorId: v.string(),
		detail: v.string(),
		payload: v.optional(v.any()),
		shopId: v.id("shops"),
		status: v.string(),
	},
	handler: async (ctx, args) => {
		await auditAction(ctx, {
			action: args.action,
			actorId: args.actorId,
			detail: args.detail,
			payload: args.payload,
			shopId: args.shopId,
			status: args.status,
		});

		return true;
	},
});

export const reindexDocuments = internalMutation({
	args: {
		jobId: v.id("syncJobs"),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const rows = await ctx.db
			.query("merchantDocuments")
			.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", args.shopId))
			.take(50);
		const now = Date.now();

		for (const row of rows) {
			const content = row.content ?? row.summary;
			await ctx.db.patch(row._id, {
				contentPreview: previewText(content),
				searchText: searchTextForDocument({
					content,
					fileName: row.fileName,
					title: row.title,
				}),
				status: "ready",
				summary: summarizeDocument(content),
				updatedAt: now,
			});
		}

		await logWorkflowEvent(ctx, {
			jobId: args.jobId,
			level: "success",
			message: `Re-indexed ${rows.length} document(s).`,
			shopId: args.shopId,
		});

		return rows.length;
	},
});

export const recordDashboardRegeneration = internalMutation({
	args: {
		jobId: v.id("syncJobs"),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		await logWorkflowEvent(ctx, {
			jobId: args.jobId,
			level: "info",
			message: "Dashboard regeneration completed without additional persisted cache work.",
			shopId: args.shopId,
		});

		return true;
	},
});

export const getOverviewSnapshotInternal = internalAction({
	args: {
		actorId: v.string(),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		windowDays: v.optional(v.number()),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		citations: MerchantCitation[];
		dashboard: ReturnType<typeof dashboardSpecSchema.parse>;
		lowStockRows: Array<Record<string, string | number | null>>;
		orderCount: number;
		orders: OrderNode[];
		revenueCurrency: string | null;
		revenueTotal: number;
	}> => {
		const installationAccessToken: string | null = await resolveUsableInstallationAccessToken(ctx, {
			shopDomain: args.shopDomain,
			shopId: args.shopId,
		});

		if (!installationAccessToken) {
			throw new Error("No connected offline Shopify token is available for this merchant tool.");
		}

		const [documents, pendingApprovalSummary, snapshot] = await Promise.all([
			ctx.runQuery(internal.merchantWorkspace.getKnowledgeDocumentsInternal, {
				shopId: args.shopId,
			}),
			ctx.runQuery(internal.merchantWorkspace.getPendingApprovalSummaryInternal, {
				shopId: args.shopId,
			}),
			fetchShopifyOverview({
				accessToken: installationAccessToken,
				shopDomain: args.shopDomain,
				windowDays: args.windowDays ?? DEFAULT_SALES_TREND_DAYS,
			}),
		]);
		const orders: OrderNode[] = snapshot.recentOrders?.nodes ?? [];
		const lowStockRows = buildLowStockRows(snapshot.lowStockProducts?.nodes ?? []);
		const citations: MerchantCitation[] = [
			buildShopifyCitation(
				"Shopify Admin orders",
				`${orders.length} recent order record(s) analysed for the requested window.`,
			),
			buildShopifyCitation(
				"Shopify Admin inventory",
				`${lowStockRows.length} low-stock row(s) are currently visible in active products.`,
			),
		];
		const revenueTotal = orders.reduce(
			(total: number, order: OrderNode) =>
				total + parseAmount(order.currentTotalPriceSet?.shopMoney?.amount),
			0,
		);
		const revenueCurrency = orders[0]?.currentTotalPriceSet?.shopMoney?.currencyCode ?? null;
		const dashboard = buildDefaultDashboard({
			activeProducts: snapshot.activeProductsCount?.count ?? 0,
			citations,
			documentCount: documents.length,
			lowStockCount: lowStockRows.length,
			lowStockRows,
			orderCount: snapshot.recentOrdersCount?.count ?? orders.length,
			pendingApprovalCount: pendingApprovalSummary.count,
			revenueCurrency,
			revenueTotal,
			salesTrend: buildTrendPoints(orders),
			topProducts: buildTopProducts(orders),
		});

		return {
			citations,
			dashboard,
			lowStockRows,
			orderCount: snapshot.recentOrdersCount?.count ?? orders.length,
			orders,
			revenueCurrency,
			revenueTotal,
		};
	},
});

export const searchProductsSnapshotInternal = internalAction({
	args: {
		shopDomain: v.string(),
		shopId: v.id("shops"),
		query: v.string(),
	},
	handler: async (ctx, args) => {
		const installationAccessToken = await resolveUsableInstallationAccessToken(ctx, {
			shopDomain: args.shopDomain,
			shopId: args.shopId,
		});

		if (!installationAccessToken) {
			throw new Error("No connected offline Shopify token is available for this merchant tool.");
		}

		return await searchShopifyProducts({
			accessToken: installationAccessToken,
			query: args.query.trim() || "status:active",
			shopDomain: args.shopDomain,
		});
	},
});

export const searchOrdersSnapshotInternal = internalAction({
	args: {
		query: v.optional(v.string()),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		windowDays: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const installationAccessToken = await resolveUsableInstallationAccessToken(ctx, {
			shopDomain: args.shopDomain,
			shopId: args.shopId,
		});

		if (!installationAccessToken) {
			throw new Error("No connected offline Shopify token is available for this merchant tool.");
		}

		return await searchShopifyOrders({
			accessToken: installationAccessToken,
			query: buildOrderSearchQuery({
				query: args.query,
				windowDays: args.windowDays,
			}),
			shopDomain: args.shopDomain,
		});
	},
});

export const getProductEditContextInternal = internalAction({
	args: {
		productId: v.string(),
		shopDomain: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const installationAccessToken = await resolveUsableInstallationAccessToken(ctx, {
			shopDomain: args.shopDomain,
			shopId: args.shopId,
		});

		if (!installationAccessToken) {
			throw new Error("No connected offline Shopify token is available for this merchant tool.");
		}

		return await getProductEditContext({
			accessToken: installationAccessToken,
			productId: args.productId,
			shopDomain: args.shopDomain,
		});
	},
});

export const copilotState = query({
	args: {
		conversationId: v.optional(v.id("merchantCopilotConversations")),
	},
	handler: async (ctx, args): Promise<MerchantCopilotConversation> => {
		const { actor, shop } = await requireMerchantActor(ctx);
		return await loadConversationState(ctx, {
			actorId: actor.id,
			conversationId: args.conversationId,
			shopId: shop._id,
		});
	},
});

export const copilotSessions = query({
	args: {},
	handler: async (ctx): Promise<MerchantCopilotSessionsData> => {
		const { actor, shop } = await requireMerchantActor(ctx);

		return {
			generatedAt: new Date().toISOString(),
			sessions: await listCopilotSessionSummaries(ctx, {
				actorId: actor.id,
				shopId: shop._id,
			}),
		};
	},
});

export const createConversation = mutation({
	args: {},
	handler: async (ctx) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const now = Date.now();
		const conversationId = await ctx.db.insert("merchantCopilotConversations", {
			actorId: actor.id,
			createdAt: now,
			shopId: shop._id,
			threadId: undefined,
			title: DEFAULT_CONVERSATION_TITLE,
			updatedAt: now,
		});

		await auditAction(ctx, {
			action: "merchant.copilot.conversation.created",
			actorId: actor.id,
			detail: "Merchant started a new copilot conversation.",
			payload: {
				conversationId,
			},
			shopId: shop._id,
			status: "success",
		});

		return {
			conversationId,
			ok: true,
		};
	},
});

export const renameConversation = mutation({
	args: {
		conversationId: v.id("merchantCopilotConversations"),
		title: v.string(),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const conversation = await ctx.db.get(args.conversationId);
		const title = args.title.trim();

		if (!conversation || conversation.shopId !== shop._id || conversation.actorId !== actor.id) {
			throw new Error("Conversation not found.");
		}

		if (title.length < 3) {
			throw new Error("Conversation title must be at least 3 characters.");
		}

		await ctx.db.patch(conversation._id, {
			title: title.slice(0, 72),
			updatedAt: Date.now(),
		});

		return {
			ok: true,
		};
	},
});

export const deleteConversation = mutation({
	args: {
		conversationId: v.id("merchantCopilotConversations"),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const conversation = await ctx.db.get(args.conversationId);

		if (!conversation || conversation.shopId !== shop._id || conversation.actorId !== actor.id) {
			throw new Error("Conversation not found.");
		}

		const approvals = await ctx.db
			.query("merchantActionApprovals")
			.withIndex("by_conversation_and_requested_at", (query) =>
				query.eq("conversationId", conversation._id),
			)
			.take(25);
		const blockingApproval = approvals.find(
			(approval) => approval.status === "pending" || approval.status === "executing",
		);

		if (blockingApproval) {
			throw new Error("Resolve pending approvals before deleting this conversation.");
		}

		await deleteConversationMessages(ctx, {
			conversationId: conversation._id,
		});
		await detachConversationApprovals(ctx, {
			conversationId: conversation._id,
		});
		await ctx.db.delete(conversation._id);

		await auditAction(ctx, {
			action: "merchant.copilot.conversation.deleted",
			actorId: actor.id,
			detail: `Merchant deleted copilot conversation ${conversation.title}.`,
			payload: {
				conversationId: conversation._id,
			},
			shopId: shop._id,
			status: "success",
		});

		return {
			ok: true,
		};
	},
});

export const knowledgeDocuments = query({
	args: {},
	handler: async (ctx) => {
		const { shop } = await requireMerchantActor(ctx);
		const rows = await listDocumentsByShop(ctx, {
			shopId: shop._id,
		});

		return {
			documents: rows.map(toDocumentRecord),
			generatedAt: new Date().toISOString(),
		};
	},
});

export const workflows = query({
	args: {},
	handler: async (ctx): Promise<MerchantWorkflowsData> => {
		const { shop } = await requireMerchantActor(ctx);

		return {
			generatedAt: new Date().toISOString(),
			records: await listWorkflowRecords(ctx, {
				shopId: shop._id,
			}),
		};
	},
});

export const uploadDocument = mutation({
	args: {
		content: v.string(),
		fileName: v.optional(v.string()),
		mimeType: v.optional(v.string()),
		title: v.string(),
		visibility: v.union(v.literal("public"), v.literal("shop_private")),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const content = args.content.trim();
		const title = args.title.trim();

		if (title.length < 3) {
			throw new Error("Document title must be at least 3 characters.");
		}

		if (content.length < 24) {
			throw new Error("Upload more document text so the copilot has something useful to search.");
		}

		const now = Date.now();
		const documentId = await ctx.db.insert("merchantDocuments", {
			content,
			contentPreview: previewText(content),
			createdAt: now,
			fileName: args.fileName?.trim() || undefined,
			mimeType: args.mimeType?.trim() || undefined,
			searchText: searchTextForDocument({
				content,
				fileName: args.fileName?.trim(),
				title,
			}),
			shopId: shop._id,
			sourceType: "inline_upload",
			status: "ready",
			summary: summarizeDocument(content),
			title,
			updatedAt: now,
			uploadedByActorId: actor.id,
			visibility: args.visibility,
		});

		await auditAction(ctx, {
			action: "merchant.document.uploaded",
			actorId: actor.id,
			detail: `Uploaded merchant knowledge document ${title}.`,
			payload: {
				documentId,
				fileName: args.fileName,
				visibility: args.visibility,
			},
			shopId: shop._id,
			status: "success",
		});

		return {
			documentId,
			ok: true,
		};
	},
});

export const deleteDocument = mutation({
	args: {
		documentId: v.id("merchantDocuments"),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const document = await ctx.db.get(args.documentId);

		if (!document || document.shopId !== shop._id) {
			throw new Error("Document not found.");
		}

		await ctx.db.delete(document._id);

		await auditAction(ctx, {
			action: "merchant.document.deleted",
			actorId: actor.id,
			detail: `Deleted merchant knowledge document ${document.title}.`,
			payload: {
				documentId: document._id,
			},
			shopId: shop._id,
			status: "success",
		});

		return {
			ok: true,
		};
	},
});

export const updateDocumentVisibility = mutation({
	args: {
		documentId: v.id("merchantDocuments"),
		visibility: v.union(v.literal("public"), v.literal("shop_private")),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const document = await ctx.db.get(args.documentId);

		if (!document || document.shopId !== shop._id) {
			throw new Error("Document not found.");
		}

		await ctx.db.patch(document._id, {
			updatedAt: Date.now(),
			visibility: args.visibility,
		});

		await auditAction(ctx, {
			action: "merchant.document.visibility_updated",
			actorId: actor.id,
			detail: `Changed document visibility for ${document.title} to ${args.visibility}.`,
			payload: {
				documentId: document._id,
				visibility: args.visibility,
			},
			shopId: shop._id,
			status: "success",
		});

		return {
			ok: true,
		};
	},
});

export const reprocessDocuments = mutation({
	args: {},
	handler: async (ctx): Promise<{ jobId: Id<"syncJobs">; ok: true }> => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const jobId: Id<"syncJobs"> = await ctx.runMutation(internal.shopifySync.queueSyncJob, {
			domain: shop.domain,
			payloadPreview: "Manual document re-index requested by merchant.",
			pendingReason: "Merchant requested document re-indexing.",
			shopId: shop._id,
			source: "merchant_copilot",
			type: "document_reindex",
		});

		await auditAction(ctx, {
			action: "merchant.document.reindex_requested",
			actorId: actor.id,
			detail: "Merchant requested document re-index workflow.",
			payload: {
				jobId,
			},
			shopId: shop._id,
			status: "pending",
		});

		return {
			jobId,
			ok: true,
		};
	},
});

export const overview = action({
	args: {},
	handler: async (ctx): Promise<MerchantOverviewData> => {
		const claims = await requireMerchantClaims(ctx);
		const runtime = await ctx.runQuery(internal.merchantWorkspace.getRuntimeStateInternal, {
			actorId: claims.actorId,
			shopDomain: claims.shopDomain,
			shopId: claims.shopId,
		});
		const installationAccessToken = await resolveUsableInstallationAccessToken(ctx, {
			shopDomain: runtime.shop.domain,
			shopId: runtime.shop._id,
		});
		const [documents, pendingApprovalSummary, recentWorkflows] = await Promise.all([
			ctx.runQuery(internal.merchantWorkspace.getKnowledgeDocumentsInternal, {
				shopId: runtime.shop._id,
			}),
			ctx.runQuery(internal.merchantWorkspace.getPendingApprovalSummaryInternal, {
				limit: OVERVIEW_PENDING_APPROVAL_LIMIT,
				shopId: runtime.shop._id,
			}),
			ctx.runQuery(internal.merchantWorkspace.getRecentWorkflowRecordsInternal, {
				logLimit: OVERVIEW_WORKFLOW_LOG_LIMIT,
				limit: OVERVIEW_WORKFLOW_RECORD_LIMIT,
				shopId: runtime.shop._id,
			}),
		]);

		let activeProducts = runtime.shop.installStatus === "connected" ? 0 : 0;
		let orderCount = 0;
		let revenueTotal = 0;
		let revenueCurrency: string | null = null;
		let salesTrend: Array<{ label: string; value: number }> = [];
		let topProducts: Array<{ label: string; value: number }> = [];
		let lowStockRows: Array<Record<string, string | number | null>> = [];
		const citations: MerchantCitation[] = [];

		if (installationAccessToken) {
			const snapshot = await fetchShopifyOverview({
				accessToken: installationAccessToken,
				shopDomain: runtime.shop.domain,
			});
			const orders = snapshot.recentOrders?.nodes ?? [];
			const lowStockProducts = snapshot.lowStockProducts?.nodes ?? [];

			activeProducts =
				snapshot.activeProductsCount?.count ?? (runtime.shop.installStatus === "connected" ? 1 : 0);
			orderCount = snapshot.recentOrdersCount?.count ?? orders.length;
			revenueTotal = orders.reduce(
				(total, order) => total + parseAmount(order.currentTotalPriceSet?.shopMoney?.amount),
				0,
			);
			revenueCurrency = orders[0]?.currentTotalPriceSet?.shopMoney?.currencyCode ?? null;
			salesTrend = buildTrendPoints(orders);
			topProducts = buildTopProducts(orders);
			lowStockRows = buildLowStockRows(lowStockProducts);
			citations.push(
				buildShopifyCitation(
					"Shopify Admin orders",
					`${orders.length} recent order record(s) in the default demo window.`,
				),
				buildShopifyCitation(
					"Shopify Admin inventory",
					`${lowStockRows.length} low-stock row(s) from current active products.`,
				),
			);
		}

		const dashboard = buildDefaultDashboard({
			activeProducts,
			citations,
			documentCount: documents.length,
			lowStockCount: lowStockRows.length,
			lowStockRows,
			orderCount,
			pendingApprovalCount: pendingApprovalSummary.count,
			revenueCurrency,
			revenueTotal,
			salesTrend,
			topProducts,
		});

		return {
			dashboard,
			generatedAt: new Date().toISOString(),
			pendingApprovals: pendingApprovalSummary.approvals,
			recentWorkflows,
		};
	},
});

export const explorer = action({
	args: {
		dataset: v.optional(
			v.union(
				v.literal("audit_logs"),
				v.literal("documents"),
				v.literal("inventory"),
				v.literal("orders"),
				v.literal("products"),
			),
		),
	},
	handler: async (ctx, args): Promise<MerchantExplorerData> => {
		const claims = await requireMerchantClaims(ctx);
		const activeDataset = args.dataset ?? "products";
		const runtime = await ctx.runQuery(internal.merchantWorkspace.getRuntimeStateInternal, {
			actorId: claims.actorId,
			shopDomain: claims.shopDomain,
			shopId: claims.shopId,
		});
		let dataset: MerchantExplorerDataset;

		switch (activeDataset) {
			case "audit_logs":
			case "documents":
			case "products":
				dataset = await ctx.runQuery(internal.merchantWorkspace.getExplorerDatasetInternal, {
					dataset: activeDataset,
					shopId: runtime.shop._id,
				});
				break;
			case "inventory": {
				const installationAccessToken = await resolveUsableInstallationAccessToken(ctx, {
					shopDomain: runtime.shop.domain,
					shopId: runtime.shop._id,
				});
				const products = installationAccessToken
					? await searchShopifyProducts({
							accessToken: installationAccessToken,
							query: "status:active",
							shopDomain: runtime.shop.domain,
						})
					: [];

				dataset = buildExplorerDataset("inventory", buildInventoryRows(products));
				break;
			}
			case "orders": {
				const installationAccessToken = await resolveUsableInstallationAccessToken(ctx, {
					shopDomain: runtime.shop.domain,
					shopId: runtime.shop._id,
				});
				const orders = installationAccessToken
					? await searchShopifyOrders({
							accessToken: installationAccessToken,
							query: recentOrdersQuery(),
							shopDomain: runtime.shop.domain,
						})
					: [];

				dataset = buildExplorerDataset("orders", buildOrderRows(orders));
				break;
			}
		}

		return {
			datasets: [dataset],
			generatedAt: new Date().toISOString(),
		};
	},
});

export const getRecentAuditRows = internalQuery({
	args: {
		limit: v.optional(v.number()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("auditLogs")
			.withIndex("by_shop_created_at", (query) => query.eq("shopId", args.shopId))
			.order("desc")
			.take(args.limit ?? EXPLORER_RECORD_LIMIT);
	},
});

export const getKnowledgeDocumentsInternal = internalQuery({
	args: {
		limit: v.optional(v.number()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		return (
			await listDocumentsByShop(ctx, {
				shopId: args.shopId,
			})
		).slice(0, args.limit ?? EXPLORER_RECORD_LIMIT);
	},
});

export const getPendingApprovalSummaryInternal = internalQuery({
	args: {
		limit: v.optional(v.number()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const approvals = await listPendingApprovalsByShop(ctx, {
			limit: PENDING_APPROVAL_SCAN_LIMIT,
			shopId: args.shopId,
		});

		return {
			approvals: approvals
				.slice(0, args.limit ?? OVERVIEW_PENDING_APPROVAL_LIMIT)
				.map(toApprovalCard),
			count: approvals.length,
		};
	},
});

export const getRecentWorkflowRecordsInternal = internalQuery({
	args: {
		logLimit: v.optional(v.number()),
		limit: v.optional(v.number()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		return await listWorkflowRecords(ctx, {
			logLimit: args.logLimit,
			recordLimit: args.limit,
			shopId: args.shopId,
		});
	},
});

export const getExplorerDatasetInternal = internalQuery({
	args: {
		dataset: v.union(v.literal("audit_logs"), v.literal("documents"), v.literal("products")),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args): Promise<MerchantExplorerDataset> => {
		switch (args.dataset) {
			case "audit_logs": {
				const rows = await ctx.db
					.query("auditLogs")
					.withIndex("by_shop_created_at", (query) => query.eq("shopId", args.shopId))
					.order("desc")
					.take(EXPLORER_RECORD_LIMIT);

				return buildExplorerDataset("audit_logs", buildAuditRows(rows));
			}
			case "documents": {
				const documents = await listDocumentsByShop(ctx, {
					shopId: args.shopId,
				});

				return buildExplorerDataset(
					"documents",
					documents.slice(0, EXPLORER_RECORD_LIMIT).map((document) => ({
						file_name: document.fileName ?? null,
						status: document.status,
						title: document.title,
						updated_at: new Date(document.updatedAt).toISOString(),
						visibility: document.visibility,
					})),
				);
			}
			case "products": {
				const rows = await ctx.db
					.query("shopifyCatalogProducts")
					.withIndex("by_shop_and_source_updated_at", (query) => query.eq("shopId", args.shopId))
					.order("desc")
					.take(EXPLORER_RECORD_LIMIT);

				return buildExplorerDataset("products", buildCatalogProductRows(rows));
			}
		}
	},
});

export const askCopilot = action({
	args: {
		conversationId: v.optional(v.id("merchantCopilotConversations")),
		prompt: v.string(),
	},
	handler: async (ctx, args): Promise<MerchantCopilotConversation> => {
		return await runMerchantCopilotTurn(ctx, args);
	},
});

async function executeApprovedAction(
	ctx: ActionCtx,
	state: {
		approval: Doc<"merchantActionApprovals">;
		installation: Doc<"shopifyInstallations"> | null;
		shop: Doc<"shops">;
	},
) {
	const accessToken = await resolveUsableInstallationAccessToken(ctx, {
		shopDomain: state.shop.domain,
		shopId: state.shop._id,
	});

	if (!accessToken) {
		throw new Error("No connected offline Shopify token is available for this approval.");
	}

	const { approval, shop } = state;
	const payload = approval.requestPayload as ApprovalPayload;

	switch (payload.tool) {
		case "updateProductStatus": {
			const response = await shopifyAdminGraphqlRequest<{
				productUpdate?: {
					product?: {
						status?: string | null;
						title?: string | null;
					} | null;
					userErrors?: Array<{ message?: string | null }> | null;
				} | null;
			}>({
				accessToken,
				query: PRODUCT_UPDATE_MUTATION,
				shop: shop.domain,
				variables: {
					product: {
						id: payload.productId,
						status: payload.status,
					},
				},
			});
			const errors = response.productUpdate?.userErrors
				?.map((error) => error.message)
				.filter(Boolean);

			if (errors && errors.length > 0) {
				throw new Error(errors.join("; "));
			}

			return `Updated product status to ${payload.status}.`;
		}
		case "updateProductContent": {
			const response = await shopifyAdminGraphqlRequest<{
				productUpdate?: {
					userErrors?: Array<{ message?: string | null }> | null;
				} | null;
			}>({
				accessToken,
				query: PRODUCT_UPDATE_MUTATION,
				shop: shop.domain,
				variables: {
					product: {
						descriptionHtml: payload.descriptionHtml,
						id: payload.productId,
						title: payload.title,
					},
				},
			});
			const errors = response.productUpdate?.userErrors
				?.map((error) => error.message)
				.filter(Boolean);

			if (errors && errors.length > 0) {
				throw new Error(errors.join("; "));
			}

			return "Updated product content.";
		}
		case "updateProductTags": {
			const query = payload.mode === "add" ? TAGS_ADD_MUTATION : TAGS_REMOVE_MUTATION;
			const response = await shopifyAdminGraphqlRequest<{
				tagsAdd?: {
					userErrors?: Array<{ message?: string | null }> | null;
				} | null;
				tagsRemove?: {
					userErrors?: Array<{ message?: string | null }> | null;
				} | null;
			}>({
				accessToken,
				query,
				shop: shop.domain,
				variables: {
					id: payload.productId,
					tags: payload.tags,
				},
			});
			const errors = (response.tagsAdd?.userErrors ?? response.tagsRemove?.userErrors ?? [])
				.map((error) => error.message)
				.filter(Boolean);

			if (errors.length > 0) {
				throw new Error(errors.join("; "));
			}

			return `${payload.mode === "add" ? "Added" : "Removed"} ${payload.tags.length} tag(s).`;
		}
		case "updateProductMetafields": {
			const response = await shopifyAdminGraphqlRequest<{
				metafieldsSet?: {
					userErrors?: Array<{ code?: string | null; message?: string | null }> | null;
				} | null;
			}>({
				accessToken,
				query: METAFIELDS_SET_MUTATION,
				shop: shop.domain,
				variables: {
					metafields: payload.metafields.map((metafield) => ({
						compareDigest: metafield.compareDigest ?? undefined,
						key: metafield.key,
						namespace: metafield.namespace,
						ownerId: payload.productId,
						type: metafield.type,
						value: metafield.value,
					})),
				},
			});
			const errors = (response.metafieldsSet?.userErrors ?? [])
				.map((error) => error.message)
				.filter(Boolean);

			if (errors.length > 0) {
				throw new Error(errors.join("; "));
			}

			return `Updated ${payload.metafields.length} metafield value(s).`;
		}
		case "adjustInventory": {
			const response = await shopifyAdminGraphqlRequest<{
				inventoryAdjustQuantities?: {
					userErrors?: Array<{ message?: string | null }> | null;
				} | null;
			}>({
				accessToken,
				query: INVENTORY_ADJUST_MUTATION,
				shop: shop.domain,
				variables: {
					input: {
						changes: [
							{
								delta: payload.delta,
								inventoryItemId: payload.variantInventoryItemId,
								locationId: payload.locationId,
							},
						],
						name: "available",
						reason: payload.reason,
						referenceDocumentUri: payload.referenceDocumentUri,
					},
				},
			});
			const errors = (response.inventoryAdjustQuantities?.userErrors ?? [])
				.map((error) => error.message)
				.filter(Boolean);

			if (errors.length > 0) {
				throw new Error(errors.join("; "));
			}

			return `Adjusted inventory by ${payload.delta} at ${payload.locationName}.`;
		}
		case "enqueueWorkflow": {
			await ctx.runMutation(internal.shopifySync.queueSyncJob, {
				domain: shop.domain,
				payloadPreview: `Approved workflow ${payload.workflowType}.`,
				pendingReason: `Approval ${approval._id} queued workflow ${payload.workflowType}.`,
				shopId: shop._id,
				source: "merchant_approval",
				type: payload.workflowType,
			});

			return `Queued workflow ${formatWorkflowTitle(payload.workflowType)}.`;
		}
		default: {
			throw new Error(`Unsupported approval tool: ${String((payload as { tool?: string }).tool)}`);
		}
	}
}

export const approveAction = action({
	args: {
		approvalId: v.id("merchantActionApprovals"),
	},
	handler: async (ctx, args) => {
		const claims = await requireMerchantClaims(ctx);
		const state = await ctx.runQuery(internal.merchantWorkspace.getApprovalExecutionState, {
			approvalId: args.approvalId,
		});

		if (!state || state.shop._id !== claims.shopId) {
			throw new Error("Approval request not found.");
		}

		if (state.approval.status !== "pending") {
			throw new Error("Approval has already been handled.");
		}

		const accessFailure = getShopifyAccessFailureReason({
			actionLabel: "execute this approval",
			installation: state.installation,
			shop: state.shop,
		});

		if (accessFailure) {
			await ctx.runMutation(internal.merchantWorkspace.setApprovalState, {
				approvalId: state.approval._id,
				errorMessage: accessFailure,
				status: "failed",
			});
			await ctx.runMutation(internal.merchantWorkspace.recordAuditLog, {
				action: `merchant.approval.${state.approval.tool}.failed`,
				actorId: state.actor.id,
				detail: state.approval.summary,
				payload: {
					approvalId: state.approval._id,
					error: accessFailure,
				},
				shopId: state.shop._id,
				status: "failed",
			});
			throw new Error(accessFailure);
		}

		await ctx.runMutation(internal.merchantWorkspace.setApprovalState, {
			approvalId: state.approval._id,
			status: "executing",
		});

		try {
			const resultSummary = await executeApprovedAction(ctx, state);

			await ctx.runMutation(internal.merchantWorkspace.setApprovalState, {
				approvalId: state.approval._id,
				resultSummary,
				status: "approved",
			});
			await ctx.runMutation(internal.merchantWorkspace.recordAuditLog, {
				action: `merchant.approval.${state.approval.tool}.approved`,
				actorId: state.actor.id,
				detail: state.approval.summary,
				payload: {
					approvalId: state.approval._id,
					resultSummary,
				},
				shopId: state.shop._id,
				status: "success",
			});

			return {
				ok: true,
				resultSummary,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Approval execution failed.";

			await ctx.runMutation(internal.merchantWorkspace.setApprovalState, {
				approvalId: state.approval._id,
				errorMessage: message,
				status: "failed",
			});
			await ctx.runMutation(internal.merchantWorkspace.recordAuditLog, {
				action: `merchant.approval.${state.approval.tool}.failed`,
				actorId: state.actor.id,
				detail: state.approval.summary,
				payload: {
					approvalId: state.approval._id,
					error: message,
				},
				shopId: state.shop._id,
				status: "failed",
			});
			throw error;
		}
	},
});

export const rejectAction = mutation({
	args: {
		approvalId: v.id("merchantActionApprovals"),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const approval = await ctx.db.get(args.approvalId);

		if (!approval || approval.shopId !== shop._id) {
			throw new Error("Approval request not found.");
		}

		if (approval.status !== "pending") {
			throw new Error("Approval has already been handled.");
		}

		await ctx.runMutation(internal.merchantWorkspace.setApprovalState, {
			approvalId: approval._id,
			resultSummary: "Merchant rejected this action.",
			status: "rejected",
		});
		await auditAction(ctx, {
			action: `merchant.approval.${approval.tool}.rejected`,
			actorId: actor.id,
			detail: approval.summary,
			payload: {
				approvalId: approval._id,
			},
			shopId: shop._id,
			status: "rejected",
		});

		return {
			ok: true,
		};
	},
});

export const searchDocumentsInternal = internalQuery({
	args: {
		query: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		return await searchDocumentsByShop(ctx, {
			query: args.query,
			shopId: args.shopId,
		});
	},
});
