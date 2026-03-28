import type { WorkflowId } from "@convex-dev/workflow";
import { internal } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
	internalAction,
	internalQuery,
	internalMutation,
	type MutationCtx,
	type QueryCtx,
} from "@convex/_generated/server";
import { resolveUsableInstallationAccessToken } from "@convex/shopify";
import { shopifyAdminGraphqlRequest } from "@convex/shopifyAdmin";
import { workflow } from "@convex/workflow";
import { v } from "convex/values";

const MERCHANT_CATALOG_CACHE_KEY = "merchant_catalog_index";
const MERCHANT_CATALOG_STALE_MS = 1000 * 60 * 30;

const MERCHANT_CATALOG_QUERY = `
	query MerchantCatalogPage($cursor: String) {
		products(first: 100, after: $cursor, sortKey: UPDATED_AT) {
			nodes {
				id
				legacyResourceId
				title
				handle
				vendor
				productType
				status
				updatedAt
				publishedAt
				onlineStoreUrl
				totalInventory
				description(truncateAt: 220)
				variantsCount {
					count
				}
			}
			pageInfo {
				hasNextPage
				endCursor
			}
		}
	}
`;

type ShopifyCount = {
	count?: number | null;
};

type MerchantCatalogPageResponse = {
	products?: {
		nodes?: Array<{
			description?: string | null;
			handle?: string | null;
			id?: string | null;
			legacyResourceId?: string | number | null;
			onlineStoreUrl?: string | null;
			productType?: string | null;
			publishedAt?: string | null;
			status?: string | null;
			title?: string | null;
			totalInventory?: number | null;
			updatedAt?: string | null;
			variantsCount?: ShopifyCount | null;
			vendor?: string | null;
		}> | null;
		pageInfo?: {
			endCursor?: string | null;
			hasNextPage?: boolean | null;
		} | null;
	} | null;
};

type MerchantCatalogRow = {
	handle: string;
	onlineStoreUrl?: string;
	productType?: string;
	publishedAt?: number;
	searchText: string;
	shopifyLegacyProductId?: string;
	shopifyProductId: string;
	sourceStatus: string;
	sourceUpdatedAt: number;
	summary: string;
	title: string;
	totalInventory?: number;
	variantCount?: number;
	vendor?: string;
};

function parseTimestamp(value: string | null | undefined) {
	if (!value) {
		return undefined;
	}

	const parsed = Date.parse(value);

	return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeCatalogDescription(value: string | null | undefined) {
	const normalized = value?.replace(/\s+/g, " ").trim();

	return normalized ? normalized.slice(0, 220) : undefined;
}

function buildMerchantCatalogSearchText(
	product: Omit<MerchantCatalogRow, "searchText" | "summary">,
	description?: string,
) {
	return [
		product.title,
		product.handle,
		product.vendor,
		product.productType,
		product.sourceStatus,
		description,
	]
		.filter(Boolean)
		.join(" ");
}

function buildMerchantCatalogSummary(
	product: Omit<MerchantCatalogRow, "searchText" | "summary">,
	description?: string,
) {
	if (description) {
		return description;
	}

	const parts = [
		product.title,
		product.vendor,
		product.productType,
		product.sourceStatus,
		product.publishedAt || product.onlineStoreUrl ? "Published" : "Not published",
		product.totalInventory === undefined ? null : `${product.totalInventory} in stock`,
		product.variantCount === undefined
			? null
			: `${product.variantCount} variant${product.variantCount === 1 ? "" : "s"}`,
	];

	return parts.filter(Boolean).join(" · ");
}

function sanitizeMerchantCatalogProduct(
	product: NonNullable<NonNullable<MerchantCatalogPageResponse["products"]>["nodes"]>[number],
) {
	const title = product.title?.trim();
	const handle = product.handle?.trim();
	const productId = product.id?.trim();
	const sourceUpdatedAt = parseTimestamp(product.updatedAt);

	if (!title || !handle || !productId || sourceUpdatedAt === undefined) {
		return null;
	}

	const description = normalizeCatalogDescription(product.description);
	const sanitized: Omit<MerchantCatalogRow, "searchText" | "summary"> = {
		handle,
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
		title,
		totalInventory:
			typeof product.totalInventory === "number" && Number.isFinite(product.totalInventory)
				? product.totalInventory
				: undefined,
		variantCount:
			typeof product.variantsCount?.count === "number" &&
			Number.isFinite(product.variantsCount.count)
				? product.variantsCount.count
				: undefined,
		vendor: product.vendor?.trim() || undefined,
	};

	return {
		...sanitized,
		searchText: buildMerchantCatalogSearchText(sanitized, description),
		summary: buildMerchantCatalogSummary(sanitized, description),
	};
}

function getCacheStaleAfter(now: number) {
	return now + MERCHANT_CATALOG_STALE_MS;
}

function shouldRefreshMerchantCatalog(
	cacheState: Awaited<ReturnType<typeof getCacheState>>,
	now: number,
) {
	if (!cacheState || !cacheState.lastCompletedAt) {
		return true;
	}

	if (cacheState.lastWebhookAt && cacheState.lastWebhookAt > cacheState.lastCompletedAt) {
		return true;
	}

	if (cacheState.staleAfterAt && cacheState.staleAfterAt <= now) {
		return true;
	}

	if (cacheState.status === "error" || cacheState.status === "disabled") {
		return true;
	}

	return false;
}

async function getCacheState(ctx: QueryCtx | MutationCtx, shopId: Id<"shops">) {
	return await ctx.db
		.query("shopifyCacheStates")
		.withIndex("by_shop_and_cache_key", (query) =>
			query.eq("shopId", shopId).eq("cacheKey", MERCHANT_CATALOG_CACHE_KEY),
		)
		.unique();
}

export const fetchMerchantCatalogPage = internalAction({
	args: {
		cursor: v.optional(v.string()),
		shopDomain: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		nextCursor: string | null;
		pageNumber: number;
		products: MerchantCatalogRow[];
		sourceUpdatedAt: number | null;
	}> => {
		const accessToken = await resolveUsableInstallationAccessToken(ctx, {
			shopDomain: args.shopDomain,
			shopId: args.shopId,
		});

		if (!accessToken) {
			throw new Error("Merchant catalog sync requires a connected offline Shopify token.");
		}

		const payload = await shopifyAdminGraphqlRequest<MerchantCatalogPageResponse>({
			accessToken,
			query: MERCHANT_CATALOG_QUERY,
			shop: args.shopDomain,
			variables: {
				cursor: args.cursor,
			},
		});
		const products = (payload.products?.nodes ?? [])
			.map((product) => sanitizeMerchantCatalogProduct(product))
			.filter((product): product is MerchantCatalogRow => Boolean(product));

		return {
			nextCursor:
				payload.products?.pageInfo?.hasNextPage && payload.products.pageInfo.endCursor
					? payload.products.pageInfo.endCursor
					: null,
			pageNumber: products.length,
			products,
			sourceUpdatedAt: products.reduce<number | null>((latest, product) => {
				if (latest === null || product.sourceUpdatedAt > latest) {
					return product.sourceUpdatedAt;
				}

				return latest;
			}, null),
		};
	},
});

export const recordMerchantCatalogWorkflowStarted = internalMutation({
	args: {
		pendingReason: v.string(),
		requestedAt: v.number(),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		workflowId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await getCacheState(ctx, args.shopId);

		if (existing) {
			await ctx.db.patch(existing._id, {
				enabled: true,
				lastError: undefined,
				lastRequestedAt: args.requestedAt,
				lastStartedAt: args.requestedAt,
				pendingReason: args.pendingReason,
				processedCount: 0,
				progressMessage: "Starting merchant catalog sync workflow.",
				status: "running",
				updatedAt: args.requestedAt,
				workflowId: args.workflowId,
			});
			return existing._id;
		}

		return await ctx.db.insert("shopifyCacheStates", {
			cacheKey: MERCHANT_CATALOG_CACHE_KEY,
			createdAt: args.requestedAt,
			domain: args.shopDomain,
			enabled: true,
			lastRequestedAt: args.requestedAt,
			lastStartedAt: args.requestedAt,
			pendingReason: args.pendingReason,
			processedCount: 0,
			progressMessage: "Starting merchant catalog sync workflow.",
			shopId: args.shopId,
			status: "running",
			updatedAt: args.requestedAt,
			workflowId: args.workflowId,
		});
	},
});

export const recordMerchantCatalogWorkflowProgress = internalMutation({
	args: {
		lastSourceUpdatedAt: v.optional(v.number()),
		message: v.string(),
		processedCount: v.number(),
		shopId: v.id("shops"),
		workflowId: v.string(),
	},
	handler: async (ctx, args) => {
		const cacheState = await getCacheState(ctx, args.shopId);

		if (!cacheState) {
			return null;
		}

		await ctx.db.patch(cacheState._id, {
			lastSourceUpdatedAt: args.lastSourceUpdatedAt,
			pendingReason: undefined,
			processedCount: args.processedCount,
			progressMessage: args.message,
			recordCount: args.processedCount,
			status: "running",
			updatedAt: Date.now(),
			workflowId: args.workflowId,
		});

		return cacheState._id;
	},
});

export const completeMerchantCatalogWorkflow = internalMutation({
	args: {
		lastSourceUpdatedAt: v.optional(v.number()),
		processedCount: v.number(),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		workflowId: v.string(),
	},
	handler: async (ctx, args) => {
		const cacheState = await getCacheState(ctx, args.shopId);
		const now = Date.now();

		if (!cacheState) {
			return null;
		}

		await ctx.db.patch(cacheState._id, {
			enabled: true,
			lastCompletedAt: now,
			lastError: undefined,
			lastRefreshedAt: now,
			lastSourceUpdatedAt: args.lastSourceUpdatedAt,
			pendingReason: undefined,
			processedCount: args.processedCount,
			progressMessage: "Merchant catalog sync completed.",
			recordCount: args.processedCount,
			staleAfterAt: getCacheStaleAfter(now),
			status: "ready",
			updatedAt: now,
			workflowId: args.workflowId,
		});

		return cacheState._id;
	},
});

export const handleMerchantCatalogWorkflowCompletion = internalMutation({
	args: {
		context: v.any(),
		result: v.any(),
		workflowId: v.string(),
	},
	handler: async (ctx, args) => {
		const context = args.context as {
			shopId: Id<"shops">;
		};
		const cacheState = await getCacheState(ctx, context.shopId);

		if (!cacheState) {
			return null;
		}

		const result = args.result as
			| { kind?: "canceled" | "error" | "success"; error?: string }
			| undefined;

		if (result?.kind === "success") {
			return cacheState._id;
		}

		const now = Date.now();
		const errorMessage =
			result?.kind === "canceled"
				? "Merchant catalog sync workflow was canceled."
				: (result?.error ?? "Merchant catalog sync workflow failed.");

		await ctx.db.patch(cacheState._id, {
			lastError: errorMessage,
			lastFailedAt: now,
			progressMessage: errorMessage,
			status: result?.kind === "canceled" ? "disabled" : "error",
			updatedAt: now,
			workflowId: args.workflowId,
		});

		return cacheState._id;
	},
});

export const merchantCatalogSyncWorkflow = workflow.define({
	args: {
		refreshedAt: v.number(),
		shopDomain: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (step, args): Promise<void> => {
		let cursor: string | undefined;
		let processedCount = 0;
		let latestSourceUpdatedAt: number | undefined;

		while (true) {
			const page = await step.runAction(
				internal.merchantCatalogWorkflow.fetchMerchantCatalogPage,
				{
					cursor,
					shopDomain: args.shopDomain,
					shopId: args.shopId,
				},
				{ name: cursor ? `fetch page after ${cursor}` : "fetch first page", retry: true },
			);

			if (page.products.length > 0) {
				await step.runMutation(
					internal.shopifySync.upsertMerchantCatalogBatch,
					{
						domain: args.shopDomain,
						products: page.products,
						refreshedAt: args.refreshedAt,
						shopId: args.shopId,
					},
					{ name: `upsert ${page.products.length} merchant products` },
				);
			}

			processedCount += page.products.length;
			if (page.sourceUpdatedAt !== null) {
				latestSourceUpdatedAt = Math.max(latestSourceUpdatedAt ?? 0, page.sourceUpdatedAt);
			}

			await step.runMutation(
				internal.merchantCatalogWorkflow.recordMerchantCatalogWorkflowProgress,
				{
					lastSourceUpdatedAt: latestSourceUpdatedAt,
					message: page.nextCursor
						? `Synced ${processedCount} merchant products so far. Fetching the next Shopify page.`
						: `Synced ${processedCount} merchant products. Cleaning up stale rows.`,
					processedCount,
					shopId: args.shopId,
					workflowId: step.workflowId,
				},
				{ inline: true, name: "record sync progress" },
			);

			if (!page.nextCursor) {
				break;
			}

			cursor = page.nextCursor;
		}

		while (true) {
			const deletedCount = await step.runMutation(
				internal.shopifySync.deleteStaleMerchantCatalogBatch,
				{
					refreshedAt: args.refreshedAt,
					shopId: args.shopId,
				},
				{ name: "delete stale merchant catalog rows" },
			);

			if (deletedCount === 0) {
				break;
			}
		}

		await step.runMutation(
			internal.merchantCatalogWorkflow.completeMerchantCatalogWorkflow,
			{
				lastSourceUpdatedAt: latestSourceUpdatedAt,
				processedCount,
				shopDomain: args.shopDomain,
				shopId: args.shopId,
				workflowId: step.workflowId,
			},
			{ inline: true, name: "complete merchant catalog sync" },
		);
	},
});

export const startMerchantCatalogSync = internalMutation({
	args: {
		pendingReason: v.string(),
		shopDomain: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args): Promise<WorkflowId | null> => {
		const cacheState = await getCacheState(ctx, args.shopId);
		const now = Date.now();

		if (cacheState?.workflowId) {
			const workflowId = cacheState.workflowId as WorkflowId;
			const status = await workflow.status(ctx, workflowId);

			if (status.type === "inProgress") {
				return workflowId;
			}

			if (status.type === "failed" || status.type === "canceled") {
				await workflow.restart(ctx, workflowId, {
					startAsync: true,
				});
				await ctx.db.patch(cacheState._id, {
					lastError: undefined,
					lastRequestedAt: now,
					pendingReason: args.pendingReason,
					progressMessage: "Resuming merchant catalog sync workflow.",
					status: "running",
					updatedAt: now,
				});

				return workflowId;
			}

			if (!shouldRefreshMerchantCatalog(cacheState, now)) {
				return workflowId;
			}
		}

		const workflowId = await workflow.start(
			ctx,
			internal.merchantCatalogWorkflow.merchantCatalogSyncWorkflow,
			{
				refreshedAt: now,
				shopDomain: args.shopDomain,
				shopId: args.shopId,
			},
			{
				context: {
					shopId: args.shopId,
				},
				onComplete: internal.merchantCatalogWorkflow.handleMerchantCatalogWorkflowCompletion,
				startAsync: true,
			},
		);

		await ctx.runMutation(internal.merchantCatalogWorkflow.recordMerchantCatalogWorkflowStarted, {
			pendingReason: args.pendingReason,
			requestedAt: now,
			shopDomain: args.shopDomain,
			shopId: args.shopId,
			workflowId,
		});

		return workflowId;
	},
});

export const getMerchantCatalogWorkflowProgress = internalQuery({
	args: {
		shopId: v.id("shops"),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		completedStepCount: number;
		status: "canceled" | "completed" | "failed" | "inProgress" | "missing";
		totalStepCount: number | null;
		workflowId: string | null;
	}> => {
		const cacheState = await getCacheState(ctx, args.shopId);

		if (!cacheState?.workflowId) {
			return {
				completedStepCount: 0,
				status: "missing",
				totalStepCount: null,
				workflowId: null,
			};
		}

		const workflowId = cacheState.workflowId as WorkflowId;
		const [status, steps] = await Promise.all([
			workflow.status(ctx, workflowId),
			workflow.listSteps(ctx, workflowId, {
				order: "asc",
				paginationOpts: {
					cursor: null,
					numItems: 256,
				},
			}),
		]);
		const completedStepCount = steps.page.filter((step) => Boolean(step.completedAt)).length;

		return {
			completedStepCount,
			status: status.type,
			totalStepCount:
				status.type === "inProgress"
					? Math.max(steps.page.length, completedStepCount + status.running.length)
					: steps.page.length,
			workflowId,
		};
	},
});
