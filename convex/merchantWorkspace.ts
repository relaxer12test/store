import { v } from "convex/values";
import {
	dashboardSpecSchema,
	type DashboardSpec,
	type MerchantApprovalCard,
	type MerchantCitation,
	type MerchantCopilotConversation,
	type MerchantDocumentRecord,
	type MerchantExplorerData,
	type MerchantOverviewData,
	type MerchantWorkflowLog,
	type MerchantWorkflowRecord,
	type MerchantWorkflowsData,
} from "../src/shared/contracts/merchant-workspace";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	action,
	internalMutation,
	internalQuery,
	mutation,
	query,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import { requireMerchantActor, requireMerchantClaims } from "./merchantAuth";
import { getShopifyAccessFailureReason } from "./shopifyAccess";
import { shopifyAdminGraphqlRequest } from "./shopifyAdmin";

const DEFAULT_CONVERSATION_TITLE = "Merchant copilot";
const DEFAULT_ORDER_WINDOW_DAYS = 30;
const DEFAULT_SALES_TREND_DAYS = 14;
const LOW_STOCK_THRESHOLD = 8;
const COPILOT_MESSAGE_LIMIT = 40;
const DOCUMENT_PREVIEW_LIMIT = 320;
const DOCUMENT_SUMMARY_LIMIT = 220;

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
	'Draft an approval to pause product "Unicorn Sparkle Backpack".',
];

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

type RetrievedKnowledgeMatch = {
	citation: MerchantCitation;
	snippet: string;
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

function promptPreview(prompt: string) {
	return normalizeText(prompt).slice(0, 180);
}

function recentOrdersQuery(days = DEFAULT_ORDER_WINDOW_DAYS) {
	const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
	return `processed_at:>=${since}`;
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

function buildDashboardForDocuments(documents: MerchantDocumentRecord[]) {
	return dashboardSpecSchema.parse({
		cards: [
			{
				description: "Recent uploaded knowledge docs available to the merchant copilot.",
				id: "document-table",
				rows: documents.map((document) => ({
					status: document.status,
					title: document.title,
					updated_at: document.updatedAt,
					visibility: document.visibility,
				})),
				columns: ["title", "visibility", "status", "updated_at"],
				type: "table",
			},
			{
				bullets: documents.slice(0, 3).map((document) => document.summary),
				description: "At-a-glance summaries from the newest uploaded documents.",
				id: "document-insight",
				tone: documents.length > 0 ? "success" : "watch",
				type: "insight",
			},
		],
		description: "Document-grounded view for merchant-private notes and public knowledge docs.",
		generatedAt: new Date().toISOString(),
		title: "Knowledge dashboard",
	});
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
		merchantActorId: Id<"merchantActors">;
		shopDomain: string;
		shopId: Id<"shops">;
		shopifyUserId: string;
	},
) {
	const actor = await ctx.db.get(args.merchantActorId);

	if (!actor || actor.shopId !== args.shopId || actor.shopifyUserId !== args.shopifyUserId) {
		throw new Error("Authenticated merchant actor could not be resolved.");
	}

	const shop = await ctx.db.get(args.shopId);

	if (!shop || shop.domain !== args.shopDomain) {
		throw new Error("Authenticated shop could not be resolved.");
	}

	const installation = await ctx.db
		.query("shopifyInstallations")
		.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
		.unique();

	return {
		actor,
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
	return await ctx.db
		.query("merchantCopilotMessages")
		.withIndex("by_conversation_and_created_at", (query) =>
			query.eq("conversationId", options.conversationId),
		)
		.take(COPILOT_MESSAGE_LIMIT);
}

async function getLatestConversation(
	ctx: QueryCtx,
	options: {
		actorId: Id<"merchantActors">;
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

async function loadConversationState(
	ctx: QueryCtx,
	options: {
		actorId: Id<"merchantActors">;
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
		shopId: Id<"shops">;
	},
): Promise<MerchantWorkflowRecord[]> {
	const rows = (await ctx.db
		.query("syncJobs")
		.withIndex("by_shop_and_last_updated_at", (query) => query.eq("shopId", options.shopId))
		.order("desc")
		.take(20)) as WorkflowRow[];

	return await Promise.all(
		rows.map(async (row) => {
			const logs = await ctx.db
				.query("workflowLogs")
				.withIndex("by_job_and_created_at", (query) => query.eq("jobId", row._id))
				.order("desc")
				.take(8);

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
		actorId: Id<"merchantActors">;
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
}): Promise<MerchantOverviewResponse> {
	return await shopifyAdminGraphqlRequest<MerchantOverviewResponse>({
		accessToken: args.accessToken,
		query: MERCHANT_OVERVIEW_QUERY,
		shop: args.shopDomain,
		variables: {
			recentOrdersQuery: recentOrdersQuery(),
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

function extractQuotedTerms(prompt: string) {
	return Array.from(prompt.matchAll(/"([^"]+)"/g))
		.map((match) => match[1])
		.filter(Boolean);
}

function parseTagsList(segment: string | undefined) {
	return (segment ?? "")
		.split(/[,\n]/)
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function classifyWorkflow(prompt: string) {
	const normalized = prompt.toLowerCase();

	if (normalized.includes("reindex") && normalized.includes("document")) {
		return "document_reindex";
	}

	if (normalized.includes("dashboard")) {
		return "dashboard_regeneration";
	}

	if (normalized.includes("catalog")) {
		return "catalog_index_rebuild";
	}

	if (normalized.includes("metrics") || normalized.includes("refresh cache")) {
		return "metrics_cache_refresh";
	}

	return "reconciliation_scan";
}

async function findProductForPrompt(args: {
	accessToken: string;
	prompt: string;
	shopDomain: string;
}) {
	const quoted = extractQuotedTerms(args.prompt);
	const searchSeed =
		quoted[0] ??
		args.prompt
			.replace(
				/add tags?|remove tags?|set metafield|adjust inventory|change title|change description|pause|publish|archive|draft/gi,
				" ",
			)
			.trim();
	const rows = await searchShopifyProducts({
		accessToken: args.accessToken,
		query: searchSeed.length > 0 ? searchSeed : "status:active",
		shopDomain: args.shopDomain,
	});

	return rows[0] ?? null;
}

function buildProductSearchRows(rows: ProductSearchNode[]) {
	return rows.map((row) => ({
		description: row.description ?? null,
		handle: row.handle ?? null,
		product_type: row.productType ?? null,
		status: row.status ?? null,
		title: row.title ?? null,
		total_inventory: (row.variants?.nodes ?? []).reduce(
			(total, variant) => total + (variant.inventoryQuantity ?? 0),
			0,
		),
		updated_at: formatFromString(row.updatedAt) ?? row.updatedAt ?? null,
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

function dashboardForPrompt(
	prompt: string,
	defaultDashboard: DashboardSpec,
	documents: MerchantDocumentRecord[],
) {
	if (/(document|note|knowledge|sop|policy)/i.test(prompt) && documents.length > 0) {
		return buildDashboardForDocuments(documents);
	}

	return defaultDashboard;
}

function mergeCitations(
	shopifyCitations: MerchantCitation[],
	documentCitations: MerchantCitation[],
) {
	return [...shopifyCitations, ...documentCitations.slice(0, 4)];
}

export const getRuntimeStateInternal = internalQuery({
	args: {
		merchantActorId: v.id("merchantActors"),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		shopifyUserId: v.string(),
	},
	handler: async (ctx, args) => {
		return await getRuntimeState(ctx, args);
	},
});

export const getConversationStateInternal = internalQuery({
	args: {
		actorId: v.id("merchantActors"),
		conversationId: v.optional(v.id("merchantCopilotConversations")),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		return await loadConversationState(ctx, args);
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

		const actor = await ctx.db.get(approval.actorId);

		if (!actor) {
			throw new Error("Approval actor could not be resolved.");
		}

		const runtime = await getRuntimeState(ctx, {
			merchantActorId: approval.actorId,
			shopDomain: approval.shopDomain,
			shopId: approval.shopId,
			shopifyUserId: actor.shopifyUserId,
		});

		return {
			actor,
			approval,
			installation: runtime.installation,
			shop: runtime.shop,
		};
	},
});

export const appendCopilotMessage = internalMutation({
	args: {
		actorId: v.id("merchantActors"),
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
				updatedAt: now,
			});
		}

		return messageId;
	},
});

export const ensureConversation = internalMutation({
	args: {
		actorId: v.id("merchantActors"),
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
			title: DEFAULT_CONVERSATION_TITLE,
			updatedAt: now,
		});
	},
});

export const createApprovalRequest = internalMutation({
	args: {
		actorId: v.id("merchantActors"),
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
		actorId: v.id("merchantActors"),
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

export const copilotState = query({
	args: {
		conversationId: v.optional(v.id("merchantCopilotConversations")),
	},
	handler: async (ctx, args): Promise<MerchantCopilotConversation> => {
		const { actor, shop } = await requireMerchantActor(ctx);
		return await loadConversationState(ctx, {
			actorId: actor._id,
			conversationId: args.conversationId,
			shopId: shop._id,
		});
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
			uploadedByActorId: actor._id,
			visibility: args.visibility,
		});

		await auditAction(ctx, {
			action: "merchant.document.uploaded",
			actorId: actor._id,
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
			actorId: actor._id,
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
			actorId: actor._id,
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
			actorId: actor._id,
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
		const runtime = await ctx.runQuery(internal.merchantWorkspace.getRuntimeStateInternal, claims);
		const [documents, workflowRecords, conversationState] = await Promise.all([
			ctx.runQuery(api.merchantDocuments.knowledgeDocuments, {}),
			ctx.runQuery(api.merchantWorkspace.workflows, {}),
			ctx.runQuery(api.merchantWorkspace.copilotState, {}),
		]);

		let activeProducts = runtime.shop.installStatus === "connected" ? 0 : 0;
		let orderCount = 0;
		let revenueTotal = 0;
		let revenueCurrency: string | null = null;
		let salesTrend: Array<{ label: string; value: number }> = [];
		let topProducts: Array<{ label: string; value: number }> = [];
		let lowStockRows: Array<Record<string, string | number | null>> = [];
		const citations: MerchantCitation[] = [];

		if (runtime.installation?.accessToken) {
			const snapshot = await fetchShopifyOverview({
				accessToken: runtime.installation.accessToken,
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
			documentCount: documents.documents.length,
			lowStockCount: lowStockRows.length,
			lowStockRows,
			orderCount,
			pendingApprovalCount: conversationState.pendingApprovals.length,
			revenueCurrency,
			revenueTotal,
			salesTrend,
			topProducts,
		});

		return {
			dashboard,
			generatedAt: new Date().toISOString(),
			pendingApprovals: conversationState.pendingApprovals,
			recentWorkflows: workflowRecords.records.slice(0, 6),
		};
	},
});

export const explorer = action({
	args: {},
	handler: async (ctx): Promise<MerchantExplorerData> => {
		const claims = await requireMerchantClaims(ctx);
		const runtime = await ctx.runQuery(internal.merchantWorkspace.getRuntimeStateInternal, claims);
		const [documents, recentAudits] = await Promise.all([
			ctx.runQuery(api.merchantDocuments.knowledgeDocuments, {}),
			ctx.runQuery(internal.merchantWorkspace.getRecentAuditRows, {
				shopId: runtime.shop._id,
			}),
		]);

		let products: ProductSearchNode[] = [];
		let orders: OrderNode[] = [];

		if (runtime.installation?.accessToken) {
			[products, orders] = await Promise.all([
				searchShopifyProducts({
					accessToken: runtime.installation.accessToken,
					query: "status:active",
					shopDomain: runtime.shop.domain,
				}),
				searchShopifyOrders({
					accessToken: runtime.installation.accessToken,
					query: recentOrdersQuery(),
					shopDomain: runtime.shop.domain,
				}),
			]);
		}

		return {
			datasets: [
				{
					description: "Current product search surface backed by Shopify Admin API reads.",
					key: "products",
					rows: buildProductSearchRows(products),
					title: "Products",
				},
				{
					description: "Recent order window aligned with the take-home demo scope.",
					key: "orders",
					rows: buildOrderRows(orders),
					title: "Orders",
				},
				{
					description: "Variant inventory view focused on low-stock operational review.",
					key: "inventory",
					rows: buildInventoryRows(products),
					title: "Inventory",
				},
				{
					description: "Uploaded merchant-private and public knowledge records.",
					key: "documents",
					rows: documents.documents.map((document: MerchantDocumentRecord) => ({
						file_name: document.fileName,
						status: document.status,
						title: document.title,
						updated_at: document.updatedAt,
						visibility: document.visibility,
					})),
					title: "Documents",
				},
				{
					description: "Approval and operational audit rows written to Convex.",
					key: "audit_logs",
					rows: buildAuditRows(recentAudits),
					title: "Audit logs",
				},
			],
			generatedAt: new Date().toISOString(),
		};
	},
});

export const getRecentAuditRows = internalQuery({
	args: {
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		return await ctx.db
			.query("auditLogs")
			.withIndex("by_shop_created_at", (query) => query.eq("shopId", args.shopId))
			.order("desc")
			.take(25);
	},
});

export const askCopilot = action({
	args: {
		conversationId: v.optional(v.id("merchantCopilotConversations")),
		prompt: v.string(),
	},
	handler: async (ctx, args): Promise<MerchantCopilotConversation> => {
		const claims = await requireMerchantClaims(ctx);
		const runtime = await ctx.runQuery(internal.merchantWorkspace.getRuntimeStateInternal, claims);
		const prompt = args.prompt.trim();

		if (prompt.length < 4) {
			throw new Error(
				"Ask a more specific merchant question so the copilot can ground the answer.",
			);
		}

		const conversationId =
			args.conversationId ??
			(await ctx.runMutation(internal.merchantWorkspace.ensureConversation, {
				actorId: runtime.actor._id,
				promptPreview: promptPreview(prompt),
				shopId: runtime.shop._id,
			}));

		await ctx.runMutation(internal.merchantWorkspace.appendCopilotMessage, {
			actorId: runtime.actor._id,
			body: prompt,
			conversationId,
			role: "user",
			shopId: runtime.shop._id,
			toolNames: [],
		});

		const quotedTerms = extractQuotedTerms(prompt);
		const lowerPrompt = prompt.toLowerCase();
		const documents = await ctx.runQuery(api.merchantDocuments.knowledgeDocuments, {});
		const knowledgeMatches: RetrievedKnowledgeMatch[] = await ctx.runAction(
			internal.merchantDocumentsNode.retrieveKnowledge,
			{
				audience: "merchant",
				query: quotedTerms[0] ?? prompt,
				shopId: runtime.shop._id,
			},
		);
		let approvalIds: Id<"merchantActionApprovals">[] = [];
		let toolNames: string[] = [];
		let body = "";
		let dashboard: DashboardSpec | null = null;
		let citations: MerchantCitation[] = [];
		const installationAccessToken = runtime.installation?.accessToken;
		const shopifyAccessFailure = getShopifyAccessFailureReason({
			actionLabel: "use the merchant copilot",
			installation: runtime.installation,
			shop: runtime.shop,
		});

		if (shopifyAccessFailure || !installationAccessToken) {
			body = `${shopifyAccessFailure} Re-run embedded bootstrap from Shopify admin after reinstalling the app if needed.`;
			citations = [
				buildShopifyCitation(
					"Install health",
					`Shop ${runtime.shop.domain} is not currently in a connected embedded-admin state.`,
				),
			];
		} else if (/(reindex|refresh|replay|rebuild|regenerate)/i.test(prompt)) {
			const workflowType = classifyWorkflow(prompt);
			const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
				actorId: runtime.actor._id,
				conversationId,
				plannedChangesJson: JSON.stringify([
					{
						after: formatWorkflowTitle(workflowType),
						before: null,
						label: "Queued workflow",
					},
				]),
				requestPayload: {
					productId: "",
					productTitle: formatWorkflowTitle(workflowType),
					tool: "enqueueWorkflow",
					workflowType,
				} satisfies ApprovalPayload,
				riskSummary:
					"Triggers background work only, but it can refresh caches or overwrite derived summaries used in the merchant UI.",
				shopDomain: runtime.shop.domain,
				shopId: runtime.shop._id,
				summary: `Queue ${formatWorkflowTitle(workflowType).toLowerCase()} for ${runtime.shop.domain}.`,
				targetLabel: formatWorkflowTitle(workflowType),
				targetType: "workflow",
				tool: "enqueueWorkflow",
			});

			approvalIds = [approvalId];
			toolNames = ["enqueueWorkflow"];
			body = `I prepared an approval card to queue ${formatWorkflowTitle(workflowType).toLowerCase()} for ${runtime.shop.domain}. Review the scope and approve it explicitly before Convex executes the workflow.`;
			citations = [
				buildShopifyCitation("Workflow scope", `Queued against shop ${runtime.shop.domain}.`),
			];
		} else if (/(pause|draft|archive|publish|activate)/i.test(prompt)) {
			const product = await findProductForPrompt({
				accessToken: installationAccessToken,
				prompt,
				shopDomain: runtime.shop.domain,
			});

			if (!product?.id) {
				body =
					'I could not identify a product to update. Quote the product title or handle, for example: pause product "Unicorn Sparkle Backpack".';
			} else {
				const status: "ACTIVE" | "ARCHIVED" | "DRAFT" = lowerPrompt.includes("archive")
					? "ARCHIVED"
					: lowerPrompt.includes("publish") || lowerPrompt.includes("activate")
						? "ACTIVE"
						: "DRAFT";
				const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
					actorId: runtime.actor._id,
					conversationId,
					plannedChangesJson: JSON.stringify([
						{
							after: status,
							before: product.status ?? null,
							label: "Product status",
						},
					]),
					requestPayload: {
						productId: product.id,
						productTitle: product.title ?? "Untitled product",
						status,
						tool: "updateProductStatus",
					} satisfies ApprovalPayload,
					riskSummary:
						status === "ACTIVE"
							? "Publishing changes visibility across sales channels."
							: "Drafting or archiving can hide the product from merchant flows and storefront shoppers.",
					shopDomain: runtime.shop.domain,
					shopId: runtime.shop._id,
					summary: `Update ${product.title ?? "product"} to status ${status}.`,
					targetId: product.id,
					targetLabel: product.title ?? "Untitled product",
					targetType: "product",
					tool: "updateProductStatus",
				});

				approvalIds = [approvalId];
				toolNames = ["getProductEditContext", "updateProductStatus"];
				body = `I prepared a status-change approval for ${product.title ?? "the selected product"}. Nothing has been written to Shopify yet.`;
				citations = [
					buildShopifyCitation(
						"Product edit context",
						`${product.title ?? "Product"} currently reports status ${product.status ?? "unknown"}.`,
					),
				];
			}
		} else if (/(add tag|remove tag)/i.test(prompt)) {
			const product = await findProductForPrompt({
				accessToken: installationAccessToken,
				prompt,
				shopDomain: runtime.shop.domain,
			});
			const addMatch = prompt.match(/add tags?\s+(.+?)\s+to/i);
			const removeMatch = prompt.match(/remove tags?\s+(.+?)\s+from/i);
			const tags = parseTagsList(addMatch?.[1] ?? removeMatch?.[1]);

			if (!product?.id || tags.length === 0) {
				body =
					'Use a direct tag instruction with a quoted product, for example: add tags "summer, featured" to "Unicorn Sparkle Backpack".';
			} else {
				const mode = addMatch ? "add" : "remove";
				const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
					actorId: runtime.actor._id,
					conversationId,
					plannedChangesJson: JSON.stringify(
						tags.map((tag) => ({
							after: mode === "add" ? tag : null,
							before: mode === "remove" ? tag : null,
							label: `Tag ${mode}`,
						})),
					),
					requestPayload: {
						mode,
						productId: product.id,
						productTitle: product.title ?? "Untitled product",
						tags,
						tool: "updateProductTags",
					} satisfies ApprovalPayload,
					riskSummary:
						"Tag changes affect merchant search, merchandising rules, and any downstream automations keyed on tags.",
					shopDomain: runtime.shop.domain,
					shopId: runtime.shop._id,
					summary: `${mode === "add" ? "Add" : "Remove"} ${tags.length} tag(s) on ${product.title ?? "product"}.`,
					targetId: product.id,
					targetLabel: product.title ?? "Untitled product",
					targetType: "product",
					tool: "updateProductTags",
				});

				approvalIds = [approvalId];
				toolNames = ["searchProducts", "updateProductTags"];
				body = `I prepared a tag update for ${product.title ?? "the selected product"} with ${tags.join(", ")}. Review the approval card before Shopify is mutated.`;
				citations = [
					buildShopifyCitation(
						"Product search",
						`${product.title ?? "Product"} matched the requested tag change.`,
					),
				];
			}
		} else if (/(change title|change description|rewrite description)/i.test(prompt)) {
			const product = await findProductForPrompt({
				accessToken: installationAccessToken,
				prompt,
				shopDomain: runtime.shop.domain,
			});
			const titleMatch = prompt.match(/change title(?: of)?\s+"[^"]+"\s+to\s+"([^"]+)"/i);
			const descriptionMatch = prompt.match(
				/(?:change|rewrite) description(?: of)?\s+"[^"]+"\s+to\s+"([^"]+)"/i,
			);

			if (!product?.id || (!titleMatch && !descriptionMatch)) {
				body =
					'Use a direct content instruction, for example: change title of "Unicorn Sparkle Backpack" to "Unicorn Trail Backpack".';
			} else {
				const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
					actorId: runtime.actor._id,
					conversationId,
					plannedChangesJson: JSON.stringify(
						[
							titleMatch
								? {
										after: titleMatch[1],
										before: product.title ?? null,
										label: "Title",
									}
								: null,
							descriptionMatch
								? {
										after: descriptionMatch[1],
										before: product.description ?? null,
										label: "Description",
									}
								: null,
						].filter(Boolean),
					),
					requestPayload: {
						descriptionHtml: descriptionMatch?.[1],
						productId: product.id,
						productTitle: product.title ?? "Untitled product",
						title: titleMatch?.[1],
						tool: "updateProductContent",
					} satisfies ApprovalPayload,
					riskSummary:
						"Content changes can affect storefront conversion, SEO, and downstream product feeds.",
					shopDomain: runtime.shop.domain,
					shopId: runtime.shop._id,
					summary: `Update core content on ${product.title ?? "product"}.`,
					targetId: product.id,
					targetLabel: product.title ?? "Untitled product",
					targetType: "product",
					tool: "updateProductContent",
				});

				approvalIds = [approvalId];
				toolNames = ["getProductEditContext", "updateProductContent"];
				body = `I prepared a content update approval for ${product.title ?? "the selected product"}. You can approve it once the before/after copy looks right.`;
				citations = [
					buildShopifyCitation(
						"Product edit context",
						`${product.title ?? "Product"} current content was loaded before preparing the approval.`,
					),
				];
			}
		} else if (/set metafield/i.test(prompt)) {
			const product = await findProductForPrompt({
				accessToken: installationAccessToken,
				prompt,
				shopDomain: runtime.shop.domain,
			});
			const fieldMatch = prompt.match(
				/set metafield\s+([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\s+to\s+"([^"]+)"/i,
			);

			if (!product?.id || !fieldMatch) {
				body =
					'Use a full namespace.key instruction, for example: set metafield custom.hero_blurb to "New copy" on "Unicorn Sparkle Backpack".';
			} else {
				const context = await getProductEditContext({
					accessToken: installationAccessToken,
					productId: product.id,
					shopDomain: runtime.shop.domain,
				});
				const [namespace, key, value] = fieldMatch.slice(1);
				const existingField = context.product?.metafields?.nodes?.find(
					(metafield) => metafield?.namespace === namespace && metafield.key === key,
				);
				const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
					actorId: runtime.actor._id,
					conversationId,
					plannedChangesJson: JSON.stringify([
						{
							after: value,
							before: existingField?.value ?? null,
							label: `${namespace}.${key}`,
						},
					]),
					requestPayload: {
						metafields: [
							{
								compareDigest: existingField?.compareDigest ?? null,
								key,
								namespace,
								type: existingField?.type ?? "single_line_text_field",
								value,
							},
						],
						productId: product.id,
						productTitle: product.title ?? "Untitled product",
						tool: "updateProductMetafields",
					} satisfies ApprovalPayload,
					riskSummary:
						"Metafield writes can affect storefront themes, app logic, and downstream automations that depend on this namespace.",
					shopDomain: runtime.shop.domain,
					shopId: runtime.shop._id,
					summary: `Set metafield ${namespace}.${key} on ${product.title ?? "product"}.`,
					targetId: product.id,
					targetLabel: product.title ?? "Untitled product",
					targetType: "product",
					tool: "updateProductMetafields",
				});

				approvalIds = [approvalId];
				toolNames = ["getProductEditContext", "updateProductMetafields"];
				body = `I prepared a metafield update for ${product.title ?? "the selected product"} under ${namespace}.${key}. Review the approval card for the exact value before execution.`;
				citations = [
					buildShopifyCitation(
						"Product metafield context",
						existingField
							? `Existing value for ${namespace}.${key} was loaded before preparing the update.`
							: `No existing value for ${namespace}.${key} was found before preparing the update.`,
					),
				];
			}
		} else if (/adjust inventory/i.test(prompt)) {
			const product = await findProductForPrompt({
				accessToken: installationAccessToken,
				prompt,
				shopDomain: runtime.shop.domain,
			});
			const deltaMatch = prompt.match(/adjust inventory(?: of)?(?:\s+"[^"]+")?\s+by\s+(-?\d+)/i);

			if (!product?.id || !deltaMatch) {
				body =
					'Use a direct delta instruction, for example: adjust inventory of "Unicorn Sparkle Backpack" by -4.';
			} else {
				const context = await getProductEditContext({
					accessToken: installationAccessToken,
					productId: product.id,
					shopDomain: runtime.shop.domain,
				});
				const variant = context.product?.variants?.nodes?.[0];
				const location =
					context.locations?.nodes?.find((row) => row.isActive) ?? context.locations?.nodes?.[0];
				const delta = Number.parseInt(deltaMatch[1], 10);

				if (!variant?.inventoryItem?.id || !location?.id) {
					body =
						"I couldn't resolve a tracked inventory item and active location for that product, so I didn't prepare a write.";
				} else {
					const approvalId = await ctx.runMutation(
						internal.merchantWorkspace.createApprovalRequest,
						{
							actorId: runtime.actor._id,
							conversationId,
							plannedChangesJson: JSON.stringify([
								{
									after: `${delta > 0 ? "+" : ""}${delta}`,
									before: `${variant.inventoryQuantity ?? 0}`,
									label: `${variant.title ?? "Default"} available delta`,
								},
							]),
							requestPayload: {
								delta,
								locationId: location.id,
								locationName: location.name ?? "Primary location",
								productTitle: context.product?.title ?? "Untitled product",
								reason: "correction",
								referenceDocumentUri: `gid://growth-capital-shopify-ai/InventoryAdjustment/${Date.now()}`,
								tool: "adjustInventory",
								variantId: variant.id ?? "",
								variantInventoryItemId: variant.inventoryItem.id,
								variantTitle: variant.title ?? "Default",
							} satisfies ApprovalPayload,
							riskSummary:
								"Inventory adjustments immediately affect merchant inventory history and downstream availability decisions.",
							shopDomain: runtime.shop.domain,
							shopId: runtime.shop._id,
							summary: `Adjust inventory on ${context.product?.title ?? "product"} by ${delta}.`,
							targetId: variant.id ?? product.id,
							targetLabel: `${context.product?.title ?? "Untitled product"} · ${variant.title ?? "Default"}`,
							targetType: "inventory",
							tool: "adjustInventory",
						},
					);

					approvalIds = [approvalId];
					toolNames = ["getProductEditContext", "adjustInventory"];
					body = `I prepared an inventory adjustment approval for ${context.product?.title ?? "the selected product"} at ${location.name ?? "the active location"}.`;
					citations = [
						buildShopifyCitation(
							"Inventory context",
							`${variant.title ?? "Default"} currently reports inventory ${variant.inventoryQuantity ?? 0}.`,
						),
					];
				}
			}
		} else {
			const [overviewData, productRows, orderRows] = await Promise.all([
				fetchShopifyOverview({
					accessToken: installationAccessToken,
					shopDomain: runtime.shop.domain,
				}),
				searchShopifyProducts({
					accessToken: installationAccessToken,
					query: quotedTerms[0] ?? "status:active",
					shopDomain: runtime.shop.domain,
				}),
				searchShopifyOrders({
					accessToken: installationAccessToken,
					query: recentOrdersQuery(),
					shopDomain: runtime.shop.domain,
				}),
			]);
			const orders = overviewData.recentOrders?.nodes ?? [];
			const lowStockRows = buildLowStockRows(overviewData.lowStockProducts?.nodes ?? []);
			const productRowsTable = buildProductSearchRows(productRows).slice(0, 6);
			const documentsDashboard = documents.documents.slice(0, 6);
			const defaultDashboard = buildDefaultDashboard({
				activeProducts: overviewData.activeProductsCount?.count ?? 0,
				citations: [
					buildShopifyCitation(
						"Shopify Admin revenue window",
						`${orders.length} recent orders analysed for dashboard generation.`,
					),
				],
				documentCount: documents.documents.length,
				lowStockCount: lowStockRows.length,
				lowStockRows,
				orderCount: overviewData.recentOrdersCount?.count ?? orders.length,
				pendingApprovalCount: 0,
				revenueCurrency: orders[0]?.currentTotalPriceSet?.shopMoney?.currencyCode ?? null,
				revenueTotal: orders.reduce(
					(total, order) => total + parseAmount(order.currentTotalPriceSet?.shopMoney?.amount),
					0,
				),
				salesTrend: buildTrendPoints(orders),
				topProducts: buildTopProducts(orders),
			});
			dashboard = dashboardForPrompt(prompt, defaultDashboard, documentsDashboard);
			citations = mergeCitations(
				[
					buildShopifyCitation(
						"Shopify Admin products",
						`${productRowsTable.length} product result(s) were considered.`,
					),
					buildShopifyCitation(
						"Shopify Admin orders",
						`${orderRows.length} order result(s) were considered.`,
					),
				],
				knowledgeMatches.map((match) => match.citation),
			);
			toolNames = [
				"getOverviewMetrics",
				"getSalesTrend",
				"getTopProducts",
				"getLowStockItems",
				"searchProducts",
				"searchOrders",
				"searchDocuments",
			];

			if (/(document|policy|sop|knowledge)/i.test(prompt) && knowledgeMatches.length > 0) {
				body = `I found ${knowledgeMatches.length} document match(es). The strongest excerpts are: ${knowledgeMatches
					.slice(0, 3)
					.map((match) => match.snippet)
					.join(" ")}`;
			} else if (/(inventory|stock)/i.test(prompt)) {
				body = lowStockRows.length
					? `There are ${lowStockRows.length} low-stock variant row(s) at or below ${LOW_STOCK_THRESHOLD}. The dashboard highlights the most urgent items first.`
					: `No low-stock variants were found under the current ${LOW_STOCK_THRESHOLD}-unit threshold in the sampled active products.`;
			} else if (/(order|sales|revenue|dashboard)/i.test(prompt)) {
				const revenue = orders.reduce(
					(total, order) => total + parseAmount(order.currentTotalPriceSet?.shopMoney?.amount),
					0,
				);
				body = `The recent demo-order window shows ${overviewData.recentOrdersCount?.count ?? orders.length} order(s) totaling ${formatMoney(
					revenue,
					orders[0]?.currentTotalPriceSet?.shopMoney?.currencyCode ?? "USD",
				)}. I rendered the dashboard from grounded Shopify data rather than freeform model HTML.`;
			} else {
				body = `I grounded this answer using live Shopify reads plus ${knowledgeMatches.length} matching merchant document excerpt(s). Use the dashboard cards and explorer datasets to drill into products, orders, inventory, or document context.`;
			}
		}

		await ctx.runMutation(internal.merchantWorkspace.appendCopilotMessage, {
			actorId: runtime.actor._id,
			approvalIds,
			body,
			citationsJson: JSON.stringify(citations),
			conversationId,
			dashboardSpecJson: dashboard ? JSON.stringify(dashboard) : undefined,
			role: "assistant",
			shopId: runtime.shop._id,
			toolNames,
		});

		return await ctx.runQuery(internal.merchantWorkspace.getConversationStateInternal, {
			actorId: runtime.actor._id,
			conversationId,
			shopId: runtime.shop._id,
		});
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
	if (!state.installation?.accessToken) {
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
				accessToken: state.installation.accessToken,
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
				accessToken: state.installation.accessToken,
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
				accessToken: state.installation.accessToken,
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
				accessToken: state.installation.accessToken,
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
				accessToken: state.installation.accessToken,
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
				actorId: state.actor._id,
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
				actorId: state.actor._id,
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
				actorId: state.actor._id,
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
			actorId: actor._id,
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
