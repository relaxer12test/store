import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type ActionCtx,
	internalAction,
	internalMutation,
	internalQuery,
	query,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import { shopifyAdminGraphqlRequest } from "./shopifyAdmin";

const PUBLIC_CATALOG_CACHE_KEY = "public_catalog_index";
const MERCHANT_METRICS_CACHE_KEY = "merchant_metrics_cache";

const CATALOG_INDEX_REBUILD_JOB = "catalog_index_rebuild";
const METRICS_CACHE_REFRESH_JOB = "metrics_cache_refresh";
const RECONCILIATION_SCAN_JOB = "reconciliation_scan";
const SHOP_UNINSTALL_CLEANUP_JOB = "shop_uninstall_cleanup";

const JOB_STATUS_PENDING = "pending";
const JOB_STATUS_RUNNING = "running";
const JOB_STATUS_COMPLETED = "completed";
const JOB_STATUS_FAILED = "failed";

const CACHE_STATUS_PENDING = "pending";
const CACHE_STATUS_RUNNING = "running";
const CACHE_STATUS_READY = "ready";
const CACHE_STATUS_ERROR = "error";
const CACHE_STATUS_DISABLED = "disabled";

const PUBLIC_CATALOG_STALE_MS = 1000 * 60 * 30;
const MERCHANT_METRICS_STALE_MS = 1000 * 60 * 15;
const RECENT_ORDER_WINDOW_DAYS = 30;
const SHOPIFY_PAGE_SIZE = 100;
const MAX_CATALOG_BATCH_SIZE = 25;
const RUN_JOB_RETRY_DELAY_MS = 10_000;

const PUBLIC_CATALOG_QUERY = `
	query PublicCatalogPage($cursor: String) {
		products(first: 100, after: $cursor, sortKey: UPDATED_AT, query: "status:active") {
			nodes {
				id
				legacyResourceId
				title
				handle
				vendor
				productType
				tags
				publishedAt
				status
				updatedAt
				onlineStoreUrl
				priceRangeV2 {
					minVariantPrice {
						amount
						currencyCode
					}
					maxVariantPrice {
						amount
						currencyCode
					}
				}
				variants(first: 20) {
					nodes {
						availableForSale
						sellableOnlineQuantity
						title
					}
				}
			}
			pageInfo {
				hasNextPage
				endCursor
			}
		}
	}
`;

const MERCHANT_METRICS_QUERY = `
	query MerchantMetricsOverview($recentOrdersQuery: String!) {
		activeProductsCount: productsCount(query: "status:active", limit: 10000) {
			count
			precision
		}
		productsCount(limit: 10000) {
			count
			precision
		}
		collectionsCount(limit: 10000) {
			count
			precision
		}
		locationsCount(limit: 10000) {
			count
			precision
		}
		ordersCount(query: $recentOrdersQuery, limit: 10000) {
			count
			precision
		}
		orders(first: 1, sortKey: PROCESSED_AT, reverse: true) {
			nodes {
				id
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

const sanitizedCatalogProductValidator = v.object({
	availableForSale: v.boolean(),
	currencyCode: v.optional(v.string()),
	handle: v.string(),
	maxPrice: v.optional(v.number()),
	minPrice: v.optional(v.number()),
	onlineStoreUrl: v.optional(v.string()),
	productType: v.optional(v.string()),
	publishedAt: v.optional(v.number()),
	searchText: v.string(),
	shopifyLegacyProductId: v.optional(v.string()),
	shopifyProductId: v.string(),
	sourceStatus: v.string(),
	sourceUpdatedAt: v.number(),
	summary: v.string(),
	tags: v.array(v.string()),
	title: v.string(),
	variantTitles: v.array(v.string()),
	vendor: v.optional(v.string()),
});

type ShopifyCount = {
	count?: number | null;
	precision?: string | null;
};

type CatalogPageResponse = {
	products?: {
		nodes?: Array<{
			handle?: string | null;
			id?: string | null;
			legacyResourceId?: string | number | null;
			onlineStoreUrl?: string | null;
			priceRangeV2?: {
				maxVariantPrice?: {
					amount?: string | null;
					currencyCode?: string | null;
				} | null;
				minVariantPrice?: {
					amount?: string | null;
					currencyCode?: string | null;
				} | null;
			} | null;
			productType?: string | null;
			publishedAt?: string | null;
			status?: string | null;
			tags?: string[] | null;
			title?: string | null;
			updatedAt?: string | null;
			variants?: {
				nodes?: Array<{
					availableForSale?: boolean | null;
					sellableOnlineQuantity?: number | null;
					title?: string | null;
				}> | null;
			} | null;
			vendor?: string | null;
		}> | null;
		pageInfo?: {
			endCursor?: string | null;
			hasNextPage?: boolean | null;
		} | null;
	} | null;
};

type MetricsOverviewResponse = {
	activeProductsCount?: ShopifyCount | null;
	collectionsCount?: ShopifyCount | null;
	locationsCount?: ShopifyCount | null;
	orders?: {
		nodes?: Array<{
			currentTotalPriceSet?: {
				shopMoney?: {
					amount?: string | null;
					currencyCode?: string | null;
				} | null;
			} | null;
			displayFinancialStatus?: string | null;
			displayFulfillmentStatus?: string | null;
			id?: string | null;
			processedAt?: string | null;
		}> | null;
	} | null;
	ordersCount?: ShopifyCount | null;
	productsCount?: ShopifyCount | null;
};

type SanitizedCatalogProduct = {
	availableForSale: boolean;
	currencyCode?: string;
	handle: string;
	maxPrice?: number;
	minPrice?: number;
	onlineStoreUrl?: string;
	productType?: string;
	publishedAt?: number;
	searchText: string;
	shopifyLegacyProductId?: string;
	shopifyProductId: string;
	sourceStatus: string;
	sourceUpdatedAt: number;
	summary: string;
	tags: string[];
	title: string;
	variantTitles: string[];
	vendor?: string;
};

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, Exclude<T[keyof T], undefined>] => {
			return entry[1] !== undefined;
		}),
	) as T;
}

function normalizeShopDomain(shopDomain: string) {
	return shopDomain.trim().toLowerCase();
}

function parseTimestamp(value: string | null | undefined) {
	if (!value) {
		return undefined;
	}

	const parsed = Date.parse(value);

	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseAmount(value: string | null | undefined) {
	if (!value) {
		return undefined;
	}

	const parsed = Number.parseFloat(value);

	return Number.isFinite(parsed) ? parsed : undefined;
}

function formatPriceLabel(minPrice?: number, maxPrice?: number, currencyCode?: string) {
	if (minPrice === undefined && maxPrice === undefined) {
		return "Price unavailable";
	}

	const formatter = new Intl.NumberFormat("en-US", {
		currency: currencyCode ?? "USD",
		style: "currency",
	});

	if (minPrice !== undefined && maxPrice !== undefined && minPrice !== maxPrice) {
		return `${formatter.format(minPrice)}-${formatter.format(maxPrice)}`;
	}

	return formatter.format(minPrice ?? maxPrice ?? 0);
}

function buildCatalogSearchText(product: Omit<SanitizedCatalogProduct, "searchText" | "summary">) {
	return [
		product.title,
		product.vendor,
		product.productType,
		...product.tags,
		...product.variantTitles,
	]
		.filter(Boolean)
		.join(" ");
}

function buildCatalogSummary(product: Omit<SanitizedCatalogProduct, "searchText" | "summary">) {
	const parts = [
		product.title,
		product.vendor,
		product.productType,
		formatPriceLabel(product.minPrice, product.maxPrice, product.currencyCode),
		product.availableForSale ? "Available online" : "Currently unavailable",
	];

	return parts.filter(Boolean).join(" · ");
}

function chunkItems<T>(items: T[], size: number) {
	const chunks: T[][] = [];

	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}

	return chunks;
}

function getCacheStaleAfter(cacheKey: string, now: number) {
	switch (cacheKey) {
		case PUBLIC_CATALOG_CACHE_KEY:
			return now + PUBLIC_CATALOG_STALE_MS;
		case MERCHANT_METRICS_CACHE_KEY:
			return now + MERCHANT_METRICS_STALE_MS;
		default:
			return now + MERCHANT_METRICS_STALE_MS;
	}
}

function getRecentOrdersQuery(days: number) {
	const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

	return `created_at:>=${sinceDate}`;
}

function isCacheRefreshRequired(
	cacheState: Doc<"shopifyCacheStates"> | null,
	options: {
		hasBackingRecord: boolean;
		now: number;
	},
) {
	if (!cacheState || !cacheState.enabled) {
		return true;
	}

	if (cacheState.status === CACHE_STATUS_ERROR || cacheState.status === "stale") {
		return true;
	}

	if (cacheState.status === CACHE_STATUS_PENDING || cacheState.status === CACHE_STATUS_RUNNING) {
		return false;
	}

	if (!cacheState.lastCompletedAt || !options.hasBackingRecord) {
		return true;
	}

	if (cacheState.lastWebhookAt && cacheState.lastWebhookAt > cacheState.lastCompletedAt) {
		return true;
	}

	if (cacheState.staleAfterAt && cacheState.staleAfterAt <= options.now) {
		return true;
	}

	return false;
}

async function getCacheState(ctx: QueryCtx | MutationCtx, shopId: Id<"shops">, cacheKey: string) {
	return await ctx.db
		.query("shopifyCacheStates")
		.withIndex("by_shop_and_cache_key", (query) =>
			query.eq("shopId", shopId).eq("cacheKey", cacheKey),
		)
		.unique();
}

async function upsertCacheState(
	ctx: MutationCtx,
	options: {
		cacheKey: string;
		domain: string;
		patch: Partial<Doc<"shopifyCacheStates">>;
		shopId: Id<"shops">;
	},
) {
	const existing = await getCacheState(ctx, options.shopId, options.cacheKey);

	if (existing) {
		await ctx.db.patch(
			existing._id,
			withoutUndefined({
				...options.patch,
				updatedAt: Date.now(),
			}),
		);

		return existing._id;
	}

	return await ctx.db.insert(
		"shopifyCacheStates",
		withoutUndefined({
			cacheKey: options.cacheKey,
			createdAt: Date.now(),
			domain: options.domain,
			enabled: true,
			shopId: options.shopId,
			status: CACHE_STATUS_PENDING,
			updatedAt: Date.now(),
			...options.patch,
		}),
	);
}

function sanitizeCatalogProduct(
	product: NonNullable<NonNullable<CatalogPageResponse["products"]>["nodes"]>[number],
) {
	const title = product.title?.trim();
	const handle = product.handle?.trim();
	const productId = product.id?.trim();
	const sourceUpdatedAt = parseTimestamp(product.updatedAt);

	if (!title || !handle || !productId || sourceUpdatedAt === undefined) {
		return null;
	}

	if (!product.onlineStoreUrl && !product.publishedAt) {
		return null;
	}

	const tags = (product.tags ?? [])
		.map((tag) => tag.trim())
		.filter(Boolean)
		.slice(0, 12);
	const variantTitles = (product.variants?.nodes ?? [])
		.map((variant) => variant.title?.trim() ?? "")
		.filter((variantTitle) => Boolean(variantTitle) && variantTitle !== "Default Title")
		.slice(0, 6);
	const availableForSale = (product.variants?.nodes ?? []).some(
		(variant) => variant.availableForSale,
	);
	const minPrice = parseAmount(product.priceRangeV2?.minVariantPrice?.amount);
	const maxPrice = parseAmount(product.priceRangeV2?.maxVariantPrice?.amount);
	const sanitized: Omit<SanitizedCatalogProduct, "searchText" | "summary"> = {
		availableForSale,
		currencyCode: product.priceRangeV2?.minVariantPrice?.currencyCode ?? undefined,
		handle,
		maxPrice,
		minPrice,
		onlineStoreUrl: product.onlineStoreUrl ?? undefined,
		productType: product.productType?.trim() || undefined,
		publishedAt: parseTimestamp(product.publishedAt),
		shopifyLegacyProductId:
			product.legacyResourceId !== undefined && product.legacyResourceId !== null
				? String(product.legacyResourceId)
				: undefined,
		shopifyProductId: productId,
		sourceStatus: product.status ?? "ACTIVE",
		sourceUpdatedAt,
		tags,
		title,
		variantTitles,
		vendor: product.vendor?.trim() || undefined,
	};

	return {
		...sanitized,
		searchText: buildCatalogSearchText(sanitized),
		summary: buildCatalogSummary(sanitized),
	};
}

async function fetchPublicCatalogProducts({
	accessToken,
	shopDomain,
}: {
	accessToken: string;
	shopDomain: string;
}) {
	const products: SanitizedCatalogProduct[] = [];
	let cursor: string | undefined;

	while (true) {
		const payload = await shopifyAdminGraphqlRequest<CatalogPageResponse>({
			accessToken,
			query: PUBLIC_CATALOG_QUERY,
			shop: shopDomain,
			variables: {
				cursor,
			},
		});
		const connection = payload.products;

		for (const node of connection?.nodes ?? []) {
			const product = sanitizeCatalogProduct(node);

			if (product) {
				products.push(product);
			}
		}

		if (!connection?.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) {
			break;
		}

		cursor = connection.pageInfo.endCursor;
	}

	return products;
}

async function fetchMetricsOverview({
	accessToken,
	shopDomain,
}: {
	accessToken: string;
	shopDomain: string;
}) {
	const payload = await shopifyAdminGraphqlRequest<MetricsOverviewResponse>({
		accessToken,
		query: MERCHANT_METRICS_QUERY,
		shop: shopDomain,
		variables: {
			recentOrdersQuery: getRecentOrdersQuery(RECENT_ORDER_WINDOW_DAYS),
		},
	});
	const lastOrder = payload.orders?.nodes?.[0];

	return {
		activeProductCount: payload.activeProductsCount?.count ?? payload.productsCount?.count ?? 0,
		collectionCount: payload.collectionsCount?.count ?? 0,
		lastOrderAt: parseTimestamp(lastOrder?.processedAt),
		lastOrderCurrencyCode: lastOrder?.currentTotalPriceSet?.shopMoney?.currencyCode ?? undefined,
		lastOrderFinancialStatus: lastOrder?.displayFinancialStatus ?? undefined,
		lastOrderFulfillmentStatus: lastOrder?.displayFulfillmentStatus ?? undefined,
		lastOrderValue: parseAmount(lastOrder?.currentTotalPriceSet?.shopMoney?.amount),
		locationCount: payload.locationsCount?.count ?? 0,
		productCount: payload.productsCount?.count ?? 0,
		recentOrderCount: payload.ordersCount?.count ?? 0,
	};
}

async function runCatalogIndexRebuild(
	ctx: ActionCtx,
	job: Doc<"syncJobs">,
	shop: Doc<"shops">,
	accessToken: string,
) {
	const refreshedAt = Date.now();
	const products = await fetchPublicCatalogProducts({
		accessToken,
		shopDomain: shop.domain,
	});

	for (const batch of chunkItems(products, MAX_CATALOG_BATCH_SIZE)) {
		await ctx.runMutation(internal.shopifySync.upsertCatalogBatch, {
			domain: shop.domain,
			products: batch,
			refreshedAt,
			shopId: shop._id,
		});
	}

	while (true) {
		const deletedCount: number = await ctx.runMutation(
			internal.shopifySync.deleteStaleCatalogBatch,
			{
				refreshedAt,
				shopId: shop._id,
			},
		);

		if (deletedCount === 0) {
			break;
		}
	}

	await ctx.runMutation(internal.shopifySync.completeJob, {
		jobId: job._id,
		payloadPreview: `Indexed ${products.length} public catalog product(s) from Shopify.`,
		recordCount: products.length,
		sourceUpdatedAt: products.reduce<number | undefined>((latest, product) => {
			if (latest === undefined || product.sourceUpdatedAt > latest) {
				return product.sourceUpdatedAt;
			}

			return latest;
		}, undefined),
	});
}

async function runMetricsCacheRefresh(
	ctx: ActionCtx,
	job: Doc<"syncJobs">,
	shop: Doc<"shops">,
	accessToken: string,
) {
	const refreshedAt = Date.now();
	const metrics = await fetchMetricsOverview({
		accessToken,
		shopDomain: shop.domain,
	});

	await ctx.runMutation(internal.shopifySync.writeMetricsCache, {
		domain: shop.domain,
		...metrics,
		refreshedAt,
		shopId: shop._id,
	});

	await ctx.runMutation(internal.shopifySync.completeJob, {
		jobId: job._id,
		payloadPreview: `Refreshed merchant metrics cache with ${metrics.productCount} products and ${metrics.recentOrderCount} recent orders.`,
		recordCount: 1,
		sourceUpdatedAt: metrics.lastOrderAt,
	});
}

async function runReconciliationScan(ctx: ActionCtx, job: Doc<"syncJobs">, shop: Doc<"shops">) {
	const state = await ctx.runQuery(internal.shopifySync.getReconciliationContext, {
		shopId: shop._id,
	});

	if (
		!state ||
		shop.installStatus !== "connected" ||
		state.installation?.accessToken === undefined
	) {
		await ctx.runMutation(internal.shopifySync.completeJob, {
			jobId: job._id,
			payloadPreview: "Skipped reconciliation because the shop is not fully connected yet.",
		});
		return;
	}

	const now = Date.now();
	const shouldRefreshCatalog = isCacheRefreshRequired(state.catalogCacheState, {
		hasBackingRecord: Boolean(state.catalogCacheState?.lastCompletedAt),
		now,
	});
	const shouldRefreshMetrics = isCacheRefreshRequired(state.metricsCacheState, {
		hasBackingRecord: state.hasMetricsCache,
		now,
	});

	if (shouldRefreshCatalog) {
		await ctx.runMutation(internal.shopifySync.queueSyncJob, {
			cacheKey: PUBLIC_CATALOG_CACHE_KEY,
			domain: shop.domain,
			pendingReason: "Reconciliation marked the public catalog cache stale or missing.",
			shopId: shop._id,
			source: job.source ?? "reconciliation",
			type: CATALOG_INDEX_REBUILD_JOB,
		});
	}

	if (shouldRefreshMetrics) {
		await ctx.runMutation(internal.shopifySync.queueSyncJob, {
			cacheKey: MERCHANT_METRICS_CACHE_KEY,
			domain: shop.domain,
			pendingReason: "Reconciliation marked the merchant metrics cache stale or missing.",
			shopId: shop._id,
			source: job.source ?? "reconciliation",
			type: METRICS_CACHE_REFRESH_JOB,
		});
	}

	await ctx.runMutation(internal.shopifySync.completeJob, {
		jobId: job._id,
		payloadPreview:
			shouldRefreshCatalog || shouldRefreshMetrics
				? "Queued follow-up cache refresh work from reconciliation."
				: "Reconciliation confirmed the current cache state is fresh enough.",
	});
}

async function runShopUninstallCleanup(ctx: ActionCtx, job: Doc<"syncJobs">, shop: Doc<"shops">) {
	while (true) {
		const batch = await ctx.runMutation(internal.shopifySync.cleanupShopDataBatch, {
			jobId: job._id,
			shopId: shop._id,
		});

		if (!batch.hasMore) {
			break;
		}
	}

	await ctx.runMutation(internal.shopifySync.completeJob, {
		jobId: job._id,
		payloadPreview: "Disabled cached Shopify data and storefront widget settings after uninstall.",
	});
}

export const searchPublicCatalog = query({
	args: {
		limit: v.optional(v.number()),
		query: v.optional(v.string()),
		shopDomain: v.string(),
	},
	handler: async (ctx, args) => {
		const shop = await ctx.db
			.query("shops")
			.withIndex("by_domain", (query) => query.eq("domain", normalizeShopDomain(args.shopDomain)))
			.unique();

		if (!shop || shop.installStatus !== "connected") {
			return [];
		}

		const limit = Math.min(Math.max(args.limit ?? 5, 1), 8);
		const searchTerm = args.query?.trim() ?? "";
		const rows =
			searchTerm.length >= 2
				? await ctx.db
						.query("shopifyCatalogProducts")
						.withSearchIndex("search_text", (query) =>
							query.search("searchText", searchTerm).eq("shopId", shop._id),
						)
						.take(limit)
				: await ctx.db
						.query("shopifyCatalogProducts")
						.withIndex("by_shop_and_source_updated_at", (query) => query.eq("shopId", shop._id))
						.order("desc")
						.take(limit);

		return rows.map((row) => ({
			availableForSale: row.availableForSale,
			handle: row.handle,
			onlineStoreUrl: row.onlineStoreUrl ?? `https://${shop.domain}/products/${row.handle}`,
			priceLabel: formatPriceLabel(row.minPrice, row.maxPrice, row.currencyCode),
			summary: row.summary,
			title: row.title,
			vendor: row.vendor ?? null,
		}));
	},
});

export const listConnectedShops = internalQuery({
	args: {},
	handler: async (ctx) => {
		const shops = await ctx.db
			.query("shops")
			.withIndex("by_install_status", (query) => query.eq("installStatus", "connected"))
			.take(100);

		return shops.map((shop) => ({
			domain: shop.domain,
			shopId: shop._id,
		}));
	},
});

export const getReconciliationContext = internalQuery({
	args: {
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const [installation, catalogCacheState, metricsCacheState, metricsCache] = await Promise.all([
			ctx.db
				.query("shopifyInstallations")
				.withIndex("by_shop", (query) => query.eq("shopId", args.shopId))
				.unique(),
			getCacheState(ctx, args.shopId, PUBLIC_CATALOG_CACHE_KEY),
			getCacheState(ctx, args.shopId, MERCHANT_METRICS_CACHE_KEY),
			ctx.db
				.query("shopifyMetricsCaches")
				.withIndex("by_shop", (query) => query.eq("shopId", args.shopId))
				.unique(),
		]);

		return {
			catalogCacheState,
			hasMetricsCache: Boolean(metricsCache),
			installation,
			metricsCacheState,
		};
	},
});

export const queueSyncJob = internalMutation({
	args: {
		cacheKey: v.optional(v.string()),
		domain: v.string(),
		payloadPreview: v.optional(v.string()),
		pendingReason: v.optional(v.string()),
		shopId: v.id("shops"),
		source: v.string(),
		triggeredByDeliveryId: v.optional(v.id("webhookDeliveries")),
		type: v.string(),
		webhookReceivedAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const existingPendingJob = await ctx.db
			.query("syncJobs")
			.withIndex("by_shop_and_type_and_status", (query) =>
				query.eq("shopId", args.shopId).eq("type", args.type).eq("status", JOB_STATUS_PENDING),
			)
			.take(1);

		if (args.cacheKey) {
			await upsertCacheState(ctx, {
				cacheKey: args.cacheKey,
				domain: args.domain,
				patch: {
					enabled: true,
					lastRequestedAt: now,
					lastWebhookAt: args.webhookReceivedAt,
					pendingReason: args.pendingReason,
					status: CACHE_STATUS_PENDING,
				},
				shopId: args.shopId,
			});
		}

		if (existingPendingJob[0]) {
			await ctx.db.patch(
				existingPendingJob[0]._id,
				withoutUndefined({
					cacheKey: args.cacheKey ?? existingPendingJob[0].cacheKey,
					lastUpdatedAt: now,
					payloadPreview: args.payloadPreview ?? existingPendingJob[0].payloadPreview,
					requestedAt: now,
					source: args.source,
					triggeredByDeliveryId:
						args.triggeredByDeliveryId ?? existingPendingJob[0].triggeredByDeliveryId,
				}),
			);

			return existingPendingJob[0]._id;
		}

		const jobId = await ctx.db.insert(
			"syncJobs",
			withoutUndefined({
				cacheKey: args.cacheKey,
				domain: args.domain,
				lastUpdatedAt: now,
				payloadPreview: args.payloadPreview,
				requestedAt: now,
				shopId: args.shopId,
				source: args.source,
				status: JOB_STATUS_PENDING,
				triggeredByDeliveryId: args.triggeredByDeliveryId,
				type: args.type,
			}),
		);

		await ctx.scheduler.runAfter(0, internal.shopifySync.runJob, {
			jobId,
		});

		return jobId;
	},
});

export const claimJob = internalMutation({
	args: {
		jobId: v.id("syncJobs"),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);

		if (!job || job.status !== JOB_STATUS_PENDING) {
			return null;
		}

		const competingRunningJob = await ctx.db
			.query("syncJobs")
			.withIndex("by_shop_and_type_and_status", (query) =>
				query.eq("shopId", job.shopId).eq("type", job.type).eq("status", JOB_STATUS_RUNNING),
			)
			.take(1);

		if (competingRunningJob[0]) {
			await ctx.scheduler.runAfter(RUN_JOB_RETRY_DELAY_MS, internal.shopifySync.runJob, {
				jobId: job._id,
			});
			return null;
		}

		const shop = await ctx.db.get(job.shopId);

		if (!shop) {
			return null;
		}

		const installation = await ctx.db
			.query("shopifyInstallations")
			.withIndex("by_shop", (query) => query.eq("shopId", job.shopId))
			.unique();
		const now = Date.now();

		await ctx.db.patch(
			job._id,
			withoutUndefined({
				lastUpdatedAt: now,
				startedAt: now,
				status: JOB_STATUS_RUNNING,
			}),
		);

		if (job.cacheKey) {
			await upsertCacheState(ctx, {
				cacheKey: job.cacheKey,
				domain: job.domain,
				patch: {
					enabled: true,
					lastStartedAt: now,
					pendingReason: undefined,
					status: CACHE_STATUS_RUNNING,
				},
				shopId: job.shopId,
			});
		}

		return {
			installation,
			job,
			shop,
		};
	},
});

export const upsertCatalogBatch = internalMutation({
	args: {
		domain: v.string(),
		products: v.array(sanitizedCatalogProductValidator),
		refreshedAt: v.number(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		for (const product of args.products) {
			const existing = await ctx.db
				.query("shopifyCatalogProducts")
				.withIndex("by_shop_and_shopify_product_id", (query) =>
					query.eq("shopId", args.shopId).eq("shopifyProductId", product.shopifyProductId),
				)
				.unique();

			const patch = withoutUndefined({
				availableForSale: product.availableForSale,
				currencyCode: product.currencyCode,
				domain: args.domain,
				handle: product.handle,
				lastRefreshedAt: args.refreshedAt,
				maxPrice: product.maxPrice,
				minPrice: product.minPrice,
				onlineStoreUrl: product.onlineStoreUrl,
				productType: product.productType,
				publishedAt: product.publishedAt,
				searchText: product.searchText,
				shopId: args.shopId,
				shopifyLegacyProductId: product.shopifyLegacyProductId,
				shopifyProductId: product.shopifyProductId,
				sourceStatus: product.sourceStatus,
				sourceUpdatedAt: product.sourceUpdatedAt,
				summary: product.summary,
				tags: product.tags,
				title: product.title,
				variantTitles: product.variantTitles,
				vendor: product.vendor,
			});

			if (existing) {
				await ctx.db.patch(existing._id, patch);
			} else {
				await ctx.db.insert("shopifyCatalogProducts", patch);
			}
		}

		return {
			ok: true,
		};
	},
});

export const deleteStaleCatalogBatch = internalMutation({
	args: {
		refreshedAt: v.number(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const staleRows = await ctx.db
			.query("shopifyCatalogProducts")
			.withIndex("by_shop_and_last_refreshed_at", (query) =>
				query.eq("shopId", args.shopId).lt("lastRefreshedAt", args.refreshedAt),
			)
			.take(SHOPIFY_PAGE_SIZE);

		for (const row of staleRows) {
			await ctx.db.delete(row._id);
		}

		return staleRows.length;
	},
});

export const writeMetricsCache = internalMutation({
	args: {
		activeProductCount: v.number(),
		collectionCount: v.number(),
		domain: v.string(),
		lastOrderAt: v.optional(v.number()),
		lastOrderCurrencyCode: v.optional(v.string()),
		lastOrderFinancialStatus: v.optional(v.string()),
		lastOrderFulfillmentStatus: v.optional(v.string()),
		lastOrderValue: v.optional(v.number()),
		locationCount: v.number(),
		productCount: v.number(),
		recentOrderCount: v.number(),
		refreshedAt: v.number(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("shopifyMetricsCaches")
			.withIndex("by_shop", (query) => query.eq("shopId", args.shopId))
			.unique();
		const patch = withoutUndefined({
			activeProductCount: args.activeProductCount,
			collectionCount: args.collectionCount,
			domain: args.domain,
			lastOrderAt: args.lastOrderAt,
			lastOrderCurrencyCode: args.lastOrderCurrencyCode,
			lastOrderFinancialStatus: args.lastOrderFinancialStatus,
			lastOrderFulfillmentStatus: args.lastOrderFulfillmentStatus,
			lastOrderValue: args.lastOrderValue,
			lastRefreshedAt: args.refreshedAt,
			locationCount: args.locationCount,
			productCount: args.productCount,
			recentOrderCount: args.recentOrderCount,
			recentOrderWindowDays: RECENT_ORDER_WINDOW_DAYS,
			shopId: args.shopId,
			updatedAt: args.refreshedAt,
		});

		if (existing) {
			await ctx.db.patch(existing._id, patch);
			return existing._id;
		}

		return await ctx.db.insert(
			"shopifyMetricsCaches",
			withoutUndefined({
				createdAt: args.refreshedAt,
				...patch,
			}),
		);
	},
});

export const completeJob = internalMutation({
	args: {
		jobId: v.id("syncJobs"),
		payloadPreview: v.optional(v.string()),
		recordCount: v.optional(v.number()),
		sourceUpdatedAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);

		if (!job) {
			return null;
		}

		const now = Date.now();

		await ctx.db.patch(
			job._id,
			withoutUndefined({
				completedAt: now,
				lastUpdatedAt: now,
				payloadPreview: args.payloadPreview ?? job.payloadPreview,
				status: JOB_STATUS_COMPLETED,
			}),
		);

		if (job.cacheKey) {
			await upsertCacheState(ctx, {
				cacheKey: job.cacheKey,
				domain: job.domain,
				patch: {
					enabled: true,
					lastCompletedAt: now,
					lastError: undefined,
					lastRefreshedAt: now,
					lastSourceUpdatedAt: args.sourceUpdatedAt,
					pendingReason: undefined,
					recordCount: args.recordCount,
					staleAfterAt: getCacheStaleAfter(job.cacheKey, now),
					status: CACHE_STATUS_READY,
				},
				shopId: job.shopId,
			});
		}

		return job._id;
	},
});

export const failJob = internalMutation({
	args: {
		error: v.string(),
		jobId: v.id("syncJobs"),
	},
	handler: async (ctx, args) => {
		const job = await ctx.db.get(args.jobId);

		if (!job) {
			return null;
		}

		const now = Date.now();

		await ctx.db.patch(
			job._id,
			withoutUndefined({
				error: args.error,
				lastUpdatedAt: now,
				status: JOB_STATUS_FAILED,
			}),
		);

		if (job.cacheKey) {
			await upsertCacheState(ctx, {
				cacheKey: job.cacheKey,
				domain: job.domain,
				patch: {
					enabled: true,
					lastError: args.error,
					lastFailedAt: now,
					pendingReason: undefined,
					status: CACHE_STATUS_ERROR,
				},
				shopId: job.shopId,
			});
		}

		return job._id;
	},
});

export const cleanupShopDataBatch = internalMutation({
	args: {
		jobId: v.id("syncJobs"),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const [installation, widgetConfig, metricsCache] = await Promise.all([
			ctx.db
				.query("shopifyInstallations")
				.withIndex("by_shop", (query) => query.eq("shopId", args.shopId))
				.unique(),
			ctx.db
				.query("widgetConfigs")
				.withIndex("by_shop", (query) => query.eq("shopId", args.shopId))
				.unique(),
			ctx.db
				.query("shopifyMetricsCaches")
				.withIndex("by_shop", (query) => query.eq("shopId", args.shopId))
				.unique(),
		]);
		const catalogRows = await ctx.db
			.query("shopifyCatalogProducts")
			.withIndex("by_shop_and_last_refreshed_at", (query) => query.eq("shopId", args.shopId))
			.take(SHOPIFY_PAGE_SIZE);
		const cacheStates = await ctx.db
			.query("shopifyCacheStates")
			.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", args.shopId))
			.take(10);

		if (installation) {
			await ctx.db.replace("shopifyInstallations", installation._id, {
				apiVersion: installation.apiVersion,
				createdAt: installation.createdAt,
				domain: installation.domain,
				lastTokenExchangeAt: now,
				scopes: installation.scopes,
				shopId: installation.shopId,
				status: "inactive",
			});
		}

		if (widgetConfig) {
			await ctx.db.patch(widgetConfig._id, {
				enabled: false,
				updatedAt: now,
			});
		}

		if (metricsCache) {
			await ctx.db.delete(metricsCache._id);
		}

		for (const row of catalogRows) {
			await ctx.db.delete(row._id);
		}

		for (const cacheState of cacheStates) {
			await ctx.db.patch(
				cacheState._id,
				withoutUndefined({
					enabled: false,
					recordCount: 0,
					status: CACHE_STATUS_DISABLED,
					updatedAt: now,
				}),
			);
		}

		await ctx.db.patch(
			args.jobId,
			withoutUndefined({
				lastUpdatedAt: now,
				payloadPreview: `Deleted ${catalogRows.length} cached catalog row(s) during uninstall cleanup.`,
			}),
		);

		const remainingCatalogRows = await ctx.db
			.query("shopifyCatalogProducts")
			.withIndex("by_shop_and_last_refreshed_at", (query) => query.eq("shopId", args.shopId))
			.take(1);

		return {
			hasMore: remainingCatalogRows.length > 0,
		};
	},
});

export const runJob = internalAction({
	args: {
		jobId: v.id("syncJobs"),
	},
	handler: async (ctx, args) => {
		const claimed = await ctx.runMutation(internal.shopifySync.claimJob, {
			jobId: args.jobId,
		});

		if (!claimed) {
			return null;
		}

		const { installation, job, shop } = claimed;

		try {
			switch (job.type) {
				case CATALOG_INDEX_REBUILD_JOB: {
					if (!installation?.accessToken) {
						throw new Error("Catalog index rebuild requires a connected offline Shopify token.");
					}

					await runCatalogIndexRebuild(ctx, job, shop, installation.accessToken);
					break;
				}
				case METRICS_CACHE_REFRESH_JOB: {
					if (!installation?.accessToken) {
						throw new Error("Metrics cache refresh requires a connected offline Shopify token.");
					}

					await runMetricsCacheRefresh(ctx, job, shop, installation.accessToken);
					break;
				}
				case RECONCILIATION_SCAN_JOB: {
					await runReconciliationScan(ctx, job, shop);
					break;
				}
				case SHOP_UNINSTALL_CLEANUP_JOB: {
					await runShopUninstallCleanup(ctx, job, shop);
					break;
				}
				default: {
					throw new Error(`Unsupported Shopify sync job type: ${job.type}`);
				}
			}
		} catch (error) {
			await ctx.runMutation(internal.shopifySync.failJob, {
				error: error instanceof Error ? error.message : "Shopify sync job failed.",
				jobId: job._id,
			});
		}

		return null;
	},
});

export const reconcileAllShops = internalAction({
	args: {},
	handler: async (ctx): Promise<{ queuedShopCount: number }> => {
		const shops: Array<{ domain: string; shopId: Id<"shops"> }> = await ctx.runQuery(
			internal.shopifySync.listConnectedShops,
			{},
		);

		for (const shop of shops) {
			await ctx.runMutation(internal.shopifySync.queueSyncJob, {
				domain: shop.domain,
				pendingReason: "Periodic reconciliation scan for Shopify-backed caches.",
				shopId: shop.shopId,
				source: "cron",
				type: RECONCILIATION_SCAN_JOB,
			});
		}

		return {
			queuedShopCount: shops.length,
		};
	},
});
