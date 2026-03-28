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
import { resolveUsableInstallationAccessToken } from "./shopify";
import { shopifyAdminGraphqlRequest } from "./shopifyAdmin";

const PUBLIC_CATALOG_CACHE_KEY = "public_catalog_index";
const MERCHANT_METRICS_CACHE_KEY = "merchant_metrics_cache";

const CATALOG_INDEX_REBUILD_JOB = "catalog_index_rebuild";
const DASHBOARD_REGENERATION_JOB = "dashboard_regeneration";
const DOCUMENT_REINDEX_JOB = "document_reindex";
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
const MAX_JOB_RETRIES = 3;
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
				description(truncateAt: 220)
				featuredImage {
					url
				}
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
						legacyResourceId
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

const PUBLIC_COLLECTIONS_QUERY = `
	query PublicCollectionPage($cursor: String) {
		collections(
			first: 100
			after: $cursor
			sortKey: UPDATED_AT
			query: "published_status:published"
		) {
			nodes {
				id
				legacyResourceId
				title
				handle
				description(truncateAt: 220)
				productsCount {
					count
				}
				updatedAt
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
	featuredImageUrl: v.optional(v.string()),
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
	variants: v.array(
		v.object({
			availableForSale: v.boolean(),
			storefrontVariantId: v.string(),
			title: v.string(),
		}),
	),
	vendor: v.optional(v.string()),
});

const sanitizedCatalogCollectionValidator = v.object({
	description: v.optional(v.string()),
	handle: v.string(),
	productCount: v.optional(v.number()),
	searchText: v.string(),
	shopifyCollectionId: v.string(),
	sourceUpdatedAt: v.number(),
	summary: v.string(),
	title: v.string(),
});

type ShopifyCount = {
	count?: number | null;
	precision?: string | null;
};

type CatalogPageResponse = {
	products?: {
		nodes?: Array<{
			description?: string | null;
			featuredImage?: {
				url?: string | null;
			} | null;
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
					legacyResourceId?: string | number | null;
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

type CollectionPageResponse = {
	collections?: {
		nodes?: Array<{
			description?: string | null;
			handle?: string | null;
			id?: string | null;
			legacyResourceId?: string | number | null;
			productsCount?: ShopifyCount | null;
			title?: string | null;
			updatedAt?: string | null;
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
	featuredImageUrl?: string;
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
	variants: Array<{
		availableForSale: boolean;
		storefrontVariantId: string;
		title: string;
	}>;
	vendor?: string;
};

type SanitizedCatalogCollection = {
	description?: string;
	handle: string;
	productCount?: number;
	searchText: string;
	shopifyCollectionId: string;
	sourceUpdatedAt: number;
	summary: string;
	title: string;
};

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, Exclude<T[keyof T], undefined>] => {
			return entry[1] !== undefined;
		}),
	) as T;
}

async function insertWorkflowLog(
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

function normalizeCatalogDescription(value: string | null | undefined) {
	const normalized = value?.replace(/\s+/g, " ").trim();

	return normalized ? normalized.slice(0, 220) : undefined;
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

function buildCatalogSearchText(
	product: Omit<SanitizedCatalogProduct, "searchText" | "summary">,
	description?: string,
) {
	return [
		product.title,
		product.vendor,
		product.productType,
		description,
		...product.tags,
		...product.variantTitles,
	]
		.filter(Boolean)
		.join(" ");
}

function buildCollectionSearchText(
	collection: Omit<SanitizedCatalogCollection, "searchText" | "summary">,
) {
	return [collection.title, collection.description].filter(Boolean).join(" ");
}

function buildCatalogSummary(
	product: Omit<SanitizedCatalogProduct, "searchText" | "summary">,
	description?: string,
) {
	if (description) {
		return description;
	}

	const parts = [
		product.title,
		product.vendor,
		product.productType,
		formatPriceLabel(product.minPrice, product.maxPrice, product.currencyCode),
		product.availableForSale ? "Available online" : "Currently unavailable",
	];

	return parts.filter(Boolean).join(" · ");
}

function buildCollectionSummary(
	collection: Omit<SanitizedCatalogCollection, "searchText" | "summary">,
) {
	const parts = [collection.title];

	if (collection.productCount !== undefined) {
		parts.push(`${collection.productCount} product${collection.productCount === 1 ? "" : "s"}`);
	}

	if (collection.description) {
		parts.push(collection.description);
	}

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

function getRetryDelayMs(retryCount: number) {
	return RUN_JOB_RETRY_DELAY_MS * Math.max(1, retryCount + 1);
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
	const variants = (product.variants?.nodes ?? [])
		.map((variant) => {
			const storefrontVariantId =
				variant.legacyResourceId !== undefined && variant.legacyResourceId !== null
					? String(variant.legacyResourceId)
					: null;
			const title = variant.title?.trim() ?? "Default";

			if (!storefrontVariantId) {
				return null;
			}

			return {
				availableForSale: Boolean(variant.availableForSale),
				storefrontVariantId,
				title,
			};
		})
		.filter((variant): variant is NonNullable<typeof variant> => Boolean(variant))
		.slice(0, 12);
	const variantTitles = (product.variants?.nodes ?? [])
		.map((variant) => variant.title?.trim() ?? "")
		.filter((variantTitle) => Boolean(variantTitle) && variantTitle !== "Default Title")
		.slice(0, 6);
	const availableForSale = (product.variants?.nodes ?? []).some(
		(variant) => variant.availableForSale,
	);
	const description = normalizeCatalogDescription(product.description);
	const minPrice = parseAmount(product.priceRangeV2?.minVariantPrice?.amount);
	const maxPrice = parseAmount(product.priceRangeV2?.maxVariantPrice?.amount);
	const sanitized: Omit<SanitizedCatalogProduct, "searchText" | "summary"> = {
		availableForSale,
		currencyCode: product.priceRangeV2?.minVariantPrice?.currencyCode ?? undefined,
		featuredImageUrl: product.featuredImage?.url?.trim() || undefined,
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
		variants,
		vendor: product.vendor?.trim() || undefined,
	};

	return {
		...sanitized,
		searchText: buildCatalogSearchText(sanitized, description),
		summary: buildCatalogSummary(sanitized, description),
	};
}

function sanitizeCatalogCollection(
	collection: NonNullable<NonNullable<CollectionPageResponse["collections"]>["nodes"]>[number],
) {
	const title = collection.title?.trim();
	const handle = collection.handle?.trim();
	const collectionId = collection.id?.trim();
	const sourceUpdatedAt = parseTimestamp(collection.updatedAt);

	if (!title || !handle || !collectionId || sourceUpdatedAt === undefined) {
		return null;
	}

	const description = collection.description?.trim() || undefined;
	const sanitized: Omit<SanitizedCatalogCollection, "searchText" | "summary"> = {
		description,
		handle,
		productCount: collection.productsCount?.count ?? undefined,
		shopifyCollectionId: collectionId,
		sourceUpdatedAt,
		title,
	};

	return {
		...sanitized,
		searchText: buildCollectionSearchText(sanitized),
		summary: buildCollectionSummary(sanitized),
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

async function fetchPublicCollections({
	accessToken,
	shopDomain,
}: {
	accessToken: string;
	shopDomain: string;
}) {
	const collections: SanitizedCatalogCollection[] = [];
	let cursor: string | undefined;

	while (true) {
		const payload = await shopifyAdminGraphqlRequest<CollectionPageResponse>({
			accessToken,
			query: PUBLIC_COLLECTIONS_QUERY,
			shop: shopDomain,
			variables: {
				cursor,
			},
		});
		const connection = payload.collections;

		for (const node of connection?.nodes ?? []) {
			const collection = sanitizeCatalogCollection(node);

			if (collection) {
				collections.push(collection);
			}
		}

		if (!connection?.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) {
			break;
		}

		cursor = connection.pageInfo.endCursor;
	}

	return collections;
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
	const [products, collections] = await Promise.all([
		fetchPublicCatalogProducts({
			accessToken,
			shopDomain: shop.domain,
		}),
		fetchPublicCollections({
			accessToken,
			shopDomain: shop.domain,
		}),
	]);

	for (const batch of chunkItems(products, MAX_CATALOG_BATCH_SIZE)) {
		await ctx.runMutation(internal.shopifySync.upsertCatalogBatch, {
			domain: shop.domain,
			products: batch,
			refreshedAt,
			shopId: shop._id,
		});
	}

	for (const batch of chunkItems(collections, MAX_CATALOG_BATCH_SIZE)) {
		await ctx.runMutation(internal.shopifySync.upsertCollectionBatch, {
			collections: batch,
			domain: shop.domain,
			refreshedAt,
			shopId: shop._id,
		});
	}

	while (true) {
		const deletedCount: { collections: number; products: number } = await ctx.runMutation(
			internal.shopifySync.deleteStaleCatalogBatch,
			{
				refreshedAt,
				shopId: shop._id,
			},
		);

		if (deletedCount.products === 0 && deletedCount.collections === 0) {
			break;
		}
	}

	await ctx.runMutation(internal.shopifySync.completeJob, {
		jobId: job._id,
		payloadPreview: `Indexed ${products.length} public products and ${collections.length} public collections from Shopify.`,
		recordCount: products.length + collections.length,
		resultSummary: `Catalog index rebuilt with ${products.length} product row(s) and ${collections.length} collection row(s).`,
		sourceUpdatedAt: [...products, ...collections].reduce<number | undefined>((latest, record) => {
			if (latest === undefined || record.sourceUpdatedAt > latest) {
				return record.sourceUpdatedAt;
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
		resultSummary: `Merchant metrics cache refreshed from Shopify for ${metrics.recentOrderCount} recent order(s).`,
		sourceUpdatedAt: metrics.lastOrderAt,
	});
}

async function runReconciliationScan(ctx: ActionCtx, job: Doc<"syncJobs">, shop: Doc<"shops">) {
	const state = await ctx.runQuery(internal.shopifySync.getReconciliationContext, {
		shopId: shop._id,
	});
	const accessToken = await resolveUsableInstallationAccessToken(ctx, {
		shopDomain: shop.domain,
		shopId: shop._id,
	});

	if (!state || shop.installStatus !== "connected" || !accessToken) {
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
		resultSummary:
			shouldRefreshCatalog || shouldRefreshMetrics
				? "Reconciliation queued follow-up cache refresh work."
				: "Reconciliation confirmed existing cache state is fresh enough.",
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
		resultSummary:
			"Shop uninstall cleanup removed cached Shopify state and disabled the widget surface.",
	});
}

async function runDashboardRegeneration(ctx: ActionCtx, job: Doc<"syncJobs">, shop: Doc<"shops">) {
	await ctx.runMutation(internal.merchantWorkspace.recordDashboardRegeneration, {
		jobId: job._id,
		shopId: shop._id,
	});

	await ctx.runMutation(internal.shopifySync.completeJob, {
		jobId: job._id,
		payloadPreview: "Regenerated the merchant dashboard view.",
		recordCount: 1,
		resultSummary: "Merchant dashboard regeneration finished.",
	});
}

async function runDocumentReindex(ctx: ActionCtx, job: Doc<"syncJobs">, shop: Doc<"shops">) {
	const result = await ctx.runAction(internal.merchantDocumentsNode.processQueuedDocuments, {
		jobId: job._id,
		shopId: shop._id,
	});
	const recordCount = result.processedCount + result.failedCount;
	const resultSummary =
		result.failedCount > 0
			? `Processed ${result.processedCount} document(s); ${result.failedCount} failed.`
			: `Processed ${result.processedCount} document(s) successfully.`;

	await ctx.runMutation(internal.shopifySync.completeJob, {
		jobId: job._id,
		payloadPreview: `Processed ${recordCount} merchant document(s).`,
		recordCount,
		resultSummary,
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
			await insertWorkflowLog(ctx, {
				detail: args.pendingReason,
				jobId: existingPendingJob[0]._id,
				level: "watch",
				message: "Queue request refreshed an existing pending workflow.",
				shopId: args.shopId,
			});

			return existingPendingJob[0]._id;
		}

		const jobId = await ctx.db.insert(
			"syncJobs",
			withoutUndefined({
				cacheKey: args.cacheKey,
				domain: args.domain,
				attemptCount: 0,
				lastUpdatedAt: now,
				payloadPreview: args.payloadPreview,
				requestedAt: now,
				retryCount: 0,
				shopId: args.shopId,
				source: args.source,
				status: JOB_STATUS_PENDING,
				triggeredByDeliveryId: args.triggeredByDeliveryId,
				type: args.type,
			}),
		);
		await insertWorkflowLog(ctx, {
			detail: args.pendingReason ?? args.payloadPreview,
			jobId,
			level: "info",
			message: "Workflow queued.",
			shopId: args.shopId,
		});

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
			const retryCount = (job.retryCount ?? 0) + 1;
			const retryAt = Date.now() + getRetryDelayMs(retryCount);
			await ctx.db.patch(job._id, {
				lastUpdatedAt: Date.now(),
				retryAt,
				retryCount,
			});
			await insertWorkflowLog(ctx, {
				detail: `Retry scheduled for ${new Date(retryAt).toISOString()}.`,
				jobId: job._id,
				level: "watch",
				message: "Another workflow of the same type is already running for this shop.",
				shopId: job.shopId,
			});
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
				attemptCount: (job.attemptCount ?? 0) + 1,
				lastUpdatedAt: now,
				retryAt: undefined,
				startedAt: now,
				status: JOB_STATUS_RUNNING,
			}),
		);
		await insertWorkflowLog(ctx, {
			detail: job.payloadPreview,
			jobId: job._id,
			level: "info",
			message: "Workflow started.",
			shopId: job.shopId,
		});

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
				featuredImageUrl: product.featuredImageUrl,
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
				variants: product.variants,
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

export const upsertCollectionBatch = internalMutation({
	args: {
		collections: v.array(sanitizedCatalogCollectionValidator),
		domain: v.string(),
		refreshedAt: v.number(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		for (const collection of args.collections) {
			const existing = await ctx.db
				.query("shopifyCatalogCollections")
				.withIndex("by_shop_and_shopify_collection_id", (query) =>
					query.eq("shopId", args.shopId).eq("shopifyCollectionId", collection.shopifyCollectionId),
				)
				.unique();

			const patch = withoutUndefined({
				description: collection.description,
				domain: args.domain,
				handle: collection.handle,
				lastRefreshedAt: args.refreshedAt,
				productCount: collection.productCount,
				searchText: collection.searchText,
				shopId: args.shopId,
				shopifyCollectionId: collection.shopifyCollectionId,
				sourceUpdatedAt: collection.sourceUpdatedAt,
				summary: collection.summary,
				title: collection.title,
			});

			if (existing) {
				await ctx.db.patch(existing._id, patch);
			} else {
				await ctx.db.insert("shopifyCatalogCollections", patch);
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
		const staleProducts = await ctx.db
			.query("shopifyCatalogProducts")
			.withIndex("by_shop_and_last_refreshed_at", (query) =>
				query.eq("shopId", args.shopId).lt("lastRefreshedAt", args.refreshedAt),
			)
			.take(SHOPIFY_PAGE_SIZE);
		const staleCollections = await ctx.db
			.query("shopifyCatalogCollections")
			.withIndex("by_shop_and_last_refreshed_at", (query) =>
				query.eq("shopId", args.shopId).lt("lastRefreshedAt", args.refreshedAt),
			)
			.take(SHOPIFY_PAGE_SIZE);

		for (const row of staleProducts) {
			await ctx.db.delete(row._id);
		}

		for (const row of staleCollections) {
			await ctx.db.delete(row._id);
		}

		return {
			collections: staleCollections.length,
			products: staleProducts.length,
		};
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
		resultSummary: v.optional(v.string()),
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
				error: undefined,
				lastUpdatedAt: now,
				payloadPreview: args.payloadPreview ?? job.payloadPreview,
				resultSummary: args.resultSummary ?? args.payloadPreview ?? job.resultSummary,
				retryAt: undefined,
				status: JOB_STATUS_COMPLETED,
			}),
		);
		await insertWorkflowLog(ctx, {
			detail: args.resultSummary ?? args.payloadPreview,
			jobId: job._id,
			level: "success",
			message: "Workflow completed.",
			shopId: job.shopId,
		});

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
		const nextRetryCount = (job.retryCount ?? 0) + 1;
		const shouldRetry = nextRetryCount <= MAX_JOB_RETRIES;

		if (shouldRetry) {
			const retryAt = now + getRetryDelayMs(nextRetryCount);

			await ctx.db.patch(
				job._id,
				withoutUndefined({
					error: args.error,
					lastUpdatedAt: now,
					resultSummary: `Retry ${nextRetryCount} of ${MAX_JOB_RETRIES} scheduled after failure.`,
					retryAt,
					retryCount: nextRetryCount,
					status: JOB_STATUS_PENDING,
				}),
			);
			await insertWorkflowLog(ctx, {
				detail: args.error,
				jobId: job._id,
				level: "error",
				message: "Workflow failed and was scheduled to retry.",
				shopId: job.shopId,
			});

			if (job.cacheKey) {
				await upsertCacheState(ctx, {
					cacheKey: job.cacheKey,
					domain: job.domain,
					patch: {
						enabled: true,
						lastError: args.error,
						lastFailedAt: now,
						pendingReason: `Retry ${nextRetryCount} scheduled after workflow failure.`,
						status: CACHE_STATUS_PENDING,
					},
					shopId: job.shopId,
				});
			}

			await ctx.scheduler.runAfter(getRetryDelayMs(nextRetryCount), internal.shopifySync.runJob, {
				jobId: job._id,
			});

			return job._id;
		}

		await ctx.db.patch(
			job._id,
			withoutUndefined({
				error: args.error,
				lastUpdatedAt: now,
				resultSummary: "Workflow failed after exhausting retries.",
				retryAt: undefined,
				retryCount: nextRetryCount,
				status: JOB_STATUS_FAILED,
			}),
		);
		await insertWorkflowLog(ctx, {
			detail: args.error,
			jobId: job._id,
			level: "error",
			message: "Workflow failed.",
			shopId: job.shopId,
		});

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
		const collectionRows = await ctx.db
			.query("shopifyCatalogCollections")
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

		for (const row of collectionRows) {
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
				payloadPreview: `Deleted ${catalogRows.length} cached product row(s) and ${collectionRows.length} collection row(s) during uninstall cleanup.`,
			}),
		);

		const [remainingCatalogRows, remainingCollectionRows] = await Promise.all([
			ctx.db
				.query("shopifyCatalogProducts")
				.withIndex("by_shop_and_last_refreshed_at", (query) => query.eq("shopId", args.shopId))
				.take(1),
			ctx.db
				.query("shopifyCatalogCollections")
				.withIndex("by_shop_and_last_refreshed_at", (query) => query.eq("shopId", args.shopId))
				.take(1),
		]);

		return {
			hasMore: remainingCatalogRows.length > 0 || remainingCollectionRows.length > 0,
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

		const { job, shop } = claimed;

		try {
			switch (job.type) {
				case CATALOG_INDEX_REBUILD_JOB: {
					const accessToken = await resolveUsableInstallationAccessToken(ctx, {
						shopDomain: shop.domain,
						shopId: shop._id,
					});

					if (!accessToken) {
						throw new Error("Catalog index rebuild requires a connected offline Shopify token.");
					}

					await runCatalogIndexRebuild(ctx, job, shop, accessToken);
					break;
				}
				case METRICS_CACHE_REFRESH_JOB: {
					const accessToken = await resolveUsableInstallationAccessToken(ctx, {
						shopDomain: shop.domain,
						shopId: shop._id,
					});

					if (!accessToken) {
						throw new Error("Metrics cache refresh requires a connected offline Shopify token.");
					}

					await runMetricsCacheRefresh(ctx, job, shop, accessToken);
					break;
				}
				case RECONCILIATION_SCAN_JOB: {
					await runReconciliationScan(ctx, job, shop);
					break;
				}
				case DASHBOARD_REGENERATION_JOB: {
					await runDashboardRegeneration(ctx, job, shop);
					break;
				}
				case DOCUMENT_REINDEX_JOB: {
					await runDocumentReindex(ctx, job, shop);
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
