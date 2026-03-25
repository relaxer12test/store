import { v } from "convex/values";
import type {
	CartPlan,
	StorefrontCollectionCard,
	StorefrontPolicyAnswers,
	StorefrontProductCard,
	StorefrontReference,
	StorefrontWidgetConfig,
} from "../src/shared/contracts/storefront-widget";
import {
	DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
	DEFAULT_STOREFRONT_WIDGET_GREETING,
	DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
	DEFAULT_STOREFRONT_WIDGET_POLICY_ANSWERS,
	DEFAULT_STOREFRONT_WIDGET_POSITION,
	DEFAULT_STOREFRONT_WIDGET_QUICK_PROMPTS,
} from "../src/shared/contracts/storefront-widget";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";

const SESSION_LIMIT = 12;
const SESSION_WINDOW_MS = 1000 * 60 * 5;
const CLIENT_LIMIT = 20;
const CLIENT_WINDOW_MS = 1000 * 60 * 10;

type WidgetConfigRecord = Doc<"widgetConfigs"> & {
	knowledgeSources?: string[];
	policyAnswers?: StorefrontPolicyAnswers;
};

type CatalogProductRecord = Doc<"shopifyCatalogProducts"> & {
	variants?: Array<{
		availableForSale: boolean;
		storefrontVariantId: string;
		title: string;
	}>;
};

type CatalogProductToolResult = StorefrontProductCard & {
	primaryVariantId: string | null;
	primaryVariantTitle: string | null;
	productType: string | null;
	tags: string[];
};

type SessionRecord = Doc<"storefrontAiSessions"> & {
	lastReply?: {
		answer: string;
		cards: Array<StorefrontProductCard | StorefrontCollectionCard>;
		cartPlan: CartPlan | null;
		references: StorefrontReference[];
		refusalReason: string | null;
		suggestedPrompts: string[];
		tone: "answer" | "refusal";
	};
};

type PolicyAnswerResult = {
	answer: string;
	references: StorefrontReference[];
	suggestedPrompts: string[];
	topic: string;
};

type HydratedPublicKnowledgeChunk = {
	document: Doc<"merchantDocuments"> | null;
	documentId: Id<"merchantDocuments">;
	snippet: string;
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

function normalizeHandle(handle: string) {
	return handle.trim().toLowerCase();
}

function normalizeSearchTerm(query: string | undefined) {
	return query?.trim() ?? "";
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

function toReferenceLabel(source: string) {
	if (/^https?:\/\//i.test(source)) {
		try {
			return new URL(source).hostname.replace(/^www\./, "");
		} catch {
			return source;
		}
	}

	return source;
}

function buildKnowledgeSourceReferences(knowledgeSources: string[]): StorefrontReference[] {
	return knowledgeSources.slice(0, 4).map((source) => ({
		label: toReferenceLabel(source),
		url: /^https?:\/\//i.test(source) ? source : undefined,
	}));
}

function buildWidgetConfig(
	shop: Doc<"shops"> | null,
	widgetConfig: WidgetConfigRecord | null,
	shopDomain: string,
): StorefrontWidgetConfig {
	return {
		accentColor: widgetConfig?.accentColor ?? DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
		enabled: shop?.installStatus === "connected" ? (widgetConfig?.enabled ?? false) : false,
		greeting: widgetConfig?.greeting ?? DEFAULT_STOREFRONT_WIDGET_GREETING,
		knowledgeSources: widgetConfig?.knowledgeSources ?? DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
		policyAnswers: widgetConfig?.policyAnswers ?? DEFAULT_STOREFRONT_WIDGET_POLICY_ANSWERS,
		position: widgetConfig?.position ?? DEFAULT_STOREFRONT_WIDGET_POSITION,
		quickPrompts: DEFAULT_STOREFRONT_WIDGET_QUICK_PROMPTS,
		shopDomain,
		shopName: shop?.name ?? "Store assistant",
	};
}

async function getShopByDomain(ctx: QueryCtx, shopDomain: string) {
	return await ctx.db
		.query("shops")
		.withIndex("by_domain", (query) => query.eq("domain", normalizeShopDomain(shopDomain)))
		.unique();
}

async function getWidgetConfigByShopId(ctx: QueryCtx, shopId: Id<"shops">) {
	return await ctx.db
		.query("widgetConfigs")
		.withIndex("by_shop", (query) => query.eq("shopId", shopId))
		.unique();
}

async function getSessionRecordByShopAndSessionId(
	ctx: QueryCtx,
	options: {
		sessionId: string;
		shopId: Id<"shops">;
	},
) {
	return (await ctx.db
		.query("storefrontAiSessions")
		.withIndex("by_shop_and_session_id", (query) =>
			query.eq("shopId", options.shopId).eq("sessionId", options.sessionId),
		)
		.unique()) as SessionRecord | null;
}

function getProductUrl(row: Doc<"shopifyCatalogProducts">) {
	return row.onlineStoreUrl ?? `https://${row.domain}/products/${row.handle}`;
}

function getCollectionUrl(row: Doc<"shopifyCatalogCollections">) {
	return `https://${row.domain}/collections/${row.handle}`;
}

function getPrimaryVariant(row: CatalogProductRecord) {
	if (!row.variants || row.variants.length === 0) {
		return null;
	}

	return row.variants.find((variant) => variant.availableForSale) ?? row.variants[0] ?? null;
}

function toProductCard(row: CatalogProductRecord): CatalogProductToolResult {
	const primaryVariant = getPrimaryVariant(row);

	return {
		availabilityLabel: row.availableForSale ? "Available online" : "Currently unavailable",
		handle: row.handle,
		href: getProductUrl(row),
		kind: "product",
		priceLabel: formatPriceLabel(row.minPrice, row.maxPrice, row.currencyCode),
		primaryVariantId: primaryVariant?.storefrontVariantId ?? null,
		primaryVariantTitle: primaryVariant?.title ?? null,
		productType: row.productType ?? null,
		summary: row.summary,
		tags: row.tags,
		title: row.title,
		vendor: row.vendor ?? null,
	};
}

function toCollectionCard(row: Doc<"shopifyCatalogCollections">): StorefrontCollectionCard {
	return {
		handle: row.handle,
		href: getCollectionUrl(row),
		kind: "collection",
		productCount: row.productCount ?? null,
		summary: row.summary,
		title: row.title,
	};
}

async function queryCatalogRows(
	ctx: QueryCtx,
	options: {
		limit: number;
		query?: string;
		shopId: Id<"shops">;
	},
) {
	const searchTerm = normalizeSearchTerm(options.query);

	if (searchTerm.length >= 2) {
		return await ctx.db
			.query("shopifyCatalogProducts")
			.withSearchIndex("search_text", (query) =>
				query.search("searchText", searchTerm).eq("shopId", options.shopId),
			)
			.take(options.limit);
	}

	return await ctx.db
		.query("shopifyCatalogProducts")
		.withIndex("by_shop_and_source_updated_at", (query) => query.eq("shopId", options.shopId))
		.order("desc")
		.take(options.limit);
}

async function queryCollectionRows(
	ctx: QueryCtx,
	options: {
		limit: number;
		query?: string;
		shopId: Id<"shops">;
	},
) {
	const searchTerm = normalizeSearchTerm(options.query);

	if (searchTerm.length >= 2) {
		return await ctx.db
			.query("shopifyCatalogCollections")
			.withSearchIndex("search_text", (query) =>
				query.search("searchText", searchTerm).eq("shopId", options.shopId),
			)
			.take(options.limit);
	}

	return await ctx.db
		.query("shopifyCatalogCollections")
		.withIndex("by_shop_and_source_updated_at", (query) => query.eq("shopId", options.shopId))
		.order("desc")
		.take(options.limit);
}

function dedupeProducts(rows: CatalogProductRecord[]) {
	const seen = new Set<string>();
	const deduped: CatalogProductRecord[] = [];

	for (const row of rows) {
		if (seen.has(row.handle)) {
			continue;
		}

		seen.add(row.handle);
		deduped.push(row);
	}

	return deduped;
}

async function consumeScopeRateLimit(
	ctx: MutationCtx,
	options: {
		clientFingerprint?: string;
		key: string;
		limit: number;
		scope: "client" | "session";
		sessionId?: string;
		shopId: Id<"shops">;
		windowMs: number;
	},
) {
	const now = Date.now();
	const existing = await ctx.db
		.query("storefrontAiRateLimits")
		.withIndex("by_shop_and_scope_and_key", (query) =>
			query.eq("shopId", options.shopId).eq("scope", options.scope).eq("key", options.key),
		)
		.unique();

	if (!existing || existing.windowEndsAt <= now) {
		if (existing) {
			await ctx.db.patch(existing._id, {
				clientFingerprint: options.clientFingerprint,
				count: 1,
				sessionId: options.sessionId,
				updatedAt: now,
				windowEndsAt: now + options.windowMs,
				windowStartedAt: now,
			});
		} else {
			await ctx.db.insert("storefrontAiRateLimits", {
				clientFingerprint: options.clientFingerprint,
				count: 1,
				key: options.key,
				scope: options.scope,
				sessionId: options.sessionId,
				shopId: options.shopId,
				updatedAt: now,
				windowEndsAt: now + options.windowMs,
				windowStartedAt: now,
			});
		}

		return {
			allowed: true,
		};
	}

	if (existing.count >= options.limit) {
		await ctx.db.patch(existing._id, {
			clientFingerprint: options.clientFingerprint,
			sessionId: options.sessionId,
			updatedAt: now,
		});

		return {
			allowed: false,
			retryAt: existing.windowEndsAt,
		};
	}

	await ctx.db.patch(existing._id, {
		clientFingerprint: options.clientFingerprint,
		count: existing.count + 1,
		sessionId: options.sessionId,
		updatedAt: now,
	});

	return {
		allowed: true,
	};
}

export const getContext = internalQuery({
	args: {
		shopDomain: v.string(),
	},
	handler: async (ctx, args) => {
		const normalizedShopDomain = normalizeShopDomain(args.shopDomain);
		const shop = await getShopByDomain(ctx, normalizedShopDomain);
		const widgetConfig = shop ? await getWidgetConfigByShopId(ctx, shop._id) : null;
		const config = buildWidgetConfig(shop, widgetConfig, normalizedShopDomain);

		return {
			config,
			shopId: shop?._id ?? null,
		};
	},
});

export const getSessionState = internalQuery({
	args: {
		sessionId: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const session = await getSessionRecordByShopAndSessionId(ctx, args);

		return session
			? {
					lastReply: session.lastReply ?? null,
					lastReplyAt: session.lastReplyAt ?? null,
					lastReplyOrder: session.lastReplyOrder ?? null,
					threadId: session.threadId,
				}
			: null;
	},
});

export const upsertSessionThread = internalMutation({
	args: {
		clientFingerprint: v.optional(v.string()),
		lastPromptPreview: v.optional(v.string()),
		sessionId: v.string(),
		shopId: v.id("shops"),
		threadId: v.string(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("storefrontAiSessions")
			.withIndex("by_shop_and_session_id", (query) =>
				query.eq("shopId", args.shopId).eq("sessionId", args.sessionId),
			)
			.unique();
		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				clientFingerprint: args.clientFingerprint,
				lastPromptAt: now,
				lastPromptPreview: args.lastPromptPreview,
				threadId: args.threadId,
				updatedAt: now,
			});

			return existing._id;
		}

		return await ctx.db.insert("storefrontAiSessions", {
			clientFingerprint: args.clientFingerprint,
			createdAt: now,
			lastPromptAt: now,
			lastPromptPreview: args.lastPromptPreview,
			sessionId: args.sessionId,
			shopId: args.shopId,
			threadId: args.threadId,
			updatedAt: now,
		});
	},
});

export const saveSessionReply = internalMutation({
	args: {
		clientFingerprint: v.optional(v.string()),
		lastPromptPreview: v.optional(v.string()),
		reply: v.object({
			answer: v.string(),
			cards: v.array(
				v.union(
					v.object({
						availabilityLabel: v.string(),
						handle: v.string(),
						href: v.string(),
						kind: v.literal("product"),
						priceLabel: v.string(),
						summary: v.string(),
						title: v.string(),
						vendor: v.union(v.string(), v.null()),
					}),
					v.object({
						handle: v.string(),
						href: v.string(),
						kind: v.literal("collection"),
						productCount: v.union(v.number(), v.null()),
						summary: v.string(),
						title: v.string(),
					}),
				),
			),
			cartPlan: v.union(
				v.object({
					explanation: v.optional(v.string()),
					items: v.array(
						v.object({
							productHandle: v.string(),
							productTitle: v.string(),
							productUrl: v.string(),
							quantity: v.number(),
							variantId: v.string(),
							variantTitle: v.string(),
						}),
					),
					note: v.optional(v.string()),
				}),
				v.null(),
			),
			references: v.array(
				v.object({
					label: v.string(),
					url: v.optional(v.string()),
				}),
			),
			refusalReason: v.union(v.string(), v.null()),
			suggestedPrompts: v.array(v.string()),
			tone: v.union(v.literal("answer"), v.literal("refusal")),
		}),
		sessionId: v.string(),
		shopId: v.id("shops"),
		threadId: v.string(),
		threadOrder: v.number(),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("storefrontAiSessions")
			.withIndex("by_shop_and_session_id", (query) =>
				query.eq("shopId", args.shopId).eq("sessionId", args.sessionId),
			)
			.unique();
		const now = Date.now();

		if (existing) {
			await ctx.db.patch(existing._id, {
				clientFingerprint: args.clientFingerprint,
				lastPromptPreview: args.lastPromptPreview,
				lastReply: args.reply,
				lastReplyAt: now,
				lastReplyOrder: args.threadOrder,
				lastPromptAt: now,
				threadId: args.threadId,
				updatedAt: now,
			});

			return existing._id;
		}

		return await ctx.db.insert("storefrontAiSessions", {
			clientFingerprint: args.clientFingerprint,
			createdAt: now,
			lastPromptAt: now,
			lastPromptPreview: args.lastPromptPreview,
			lastReply: args.reply,
			lastReplyAt: now,
			lastReplyOrder: args.threadOrder,
			sessionId: args.sessionId,
			shopId: args.shopId,
			threadId: args.threadId,
			updatedAt: now,
		});
	},
});

export const searchCatalog = internalQuery({
	args: {
		limit: v.optional(v.number()),
		query: v.optional(v.string()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const rows = (await queryCatalogRows(ctx, {
			limit: Math.min(Math.max(args.limit ?? 4, 1), 6),
			query: args.query,
			shopId: args.shopId,
		})) as CatalogProductRecord[];

		return rows.map(toProductCard);
	},
});

export const getProductDetail = internalQuery({
	args: {
		handle: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const row = (await ctx.db
			.query("shopifyCatalogProducts")
			.withIndex("by_shop_and_handle", (query) =>
				query.eq("shopId", args.shopId).eq("handle", normalizeHandle(args.handle)),
			)
			.unique()) as CatalogProductRecord | null;

		return row ? toProductCard(row) : null;
	},
});

export const compareProducts = internalQuery({
	args: {
		handles: v.array(v.string()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const uniqueHandles = Array.from(new Set(args.handles.map(normalizeHandle))).slice(0, 3);
		const cards: CatalogProductToolResult[] = [];

		for (const handle of uniqueHandles) {
			const row = (await ctx.db
				.query("shopifyCatalogProducts")
				.withIndex("by_shop_and_handle", (query) =>
					query.eq("shopId", args.shopId).eq("handle", handle),
				)
				.unique()) as CatalogProductRecord | null;

			if (row) {
				cards.push(toProductCard(row));
			}
		}

		return cards;
	},
});

export const searchCollections = internalQuery({
	args: {
		limit: v.optional(v.number()),
		query: v.optional(v.string()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const rows = await queryCollectionRows(ctx, {
			limit: Math.min(Math.max(args.limit ?? 4, 1), 6),
			query: args.query,
			shopId: args.shopId,
		});

		return rows.map(toCollectionCard);
	},
});

export const answerPolicyQuestion = internalQuery({
	args: {
		question: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args): Promise<PolicyAnswerResult> => {
		const shop = await ctx.db.get(args.shopId);
		const widgetConfig = await getWidgetConfigByShopId(ctx, args.shopId);
		const config = buildWidgetConfig(shop, widgetConfig, shop?.domain ?? "storefront");
		const normalized = args.question.toLowerCase();
		const chunkMatches = await ctx.runQuery(
			internal.merchantDocuments.searchKnowledgeChunksByText,
			{
				limit: 4,
				query: args.question,
				shopId: args.shopId,
				visibility: "public",
			},
		);
		const hydratedMatches: HydratedPublicKnowledgeChunk[] =
			chunkMatches.length > 0
				? await ctx.runQuery(internal.merchantDocuments.hydrateKnowledgeChunks, {
						chunkIds: chunkMatches.map((row) => row._id),
					})
				: [];
		const publicDocumentMatches = hydratedMatches.filter(
			(row): row is HydratedPublicKnowledgeChunk & { document: Doc<"merchantDocuments"> } => {
				const document = row.document;
				return (
					document !== null &&
					document.status === "ready" &&
					document.visibility === "public" &&
					document.shopId === args.shopId
				);
			},
		);
		const publicDocumentReferences = Array.from(
			new Map(
				publicDocumentMatches.map((row) => [row.document._id, { label: row.document.title }]),
			).values(),
		).slice(0, 4);
		const references =
			publicDocumentReferences.length > 0
				? publicDocumentReferences
				: buildKnowledgeSourceReferences(config.knowledgeSources);
		const documentAnswer =
			publicDocumentMatches.length > 0
				? publicDocumentMatches
						.slice(0, 2)
						.map((row) => row.snippet)
						.join(" ")
						.slice(0, 480)
				: null;

		if (
			normalized.includes("shipping") ||
			normalized.includes("delivery") ||
			normalized.includes("ship")
		) {
			return {
				answer: documentAnswer ?? config.policyAnswers.shipping,
				references,
				suggestedPrompts: [
					"What shipping options should I expect?",
					"How do returns work?",
					"Help me choose a product first",
				],
				topic: "shipping",
			};
		}

		if (
			normalized.includes("return") ||
			normalized.includes("refund") ||
			normalized.includes("exchange")
		) {
			return {
				answer: documentAnswer ?? config.policyAnswers.returns,
				references,
				suggestedPrompts: [
					"What is the shipping policy?",
					"Compare a few options for me",
					"Help me build a bundle",
				],
				topic: "returns",
			};
		}

		return {
			answer: documentAnswer ?? config.policyAnswers.contact,
			references,
			suggestedPrompts: [
				"How do returns work?",
				"Help me find a product",
				"Build me a starter bundle",
			],
			topic: "contact",
		};
	},
});

export const recommendBundle = internalQuery({
	args: {
		pageTitle: v.optional(v.string()),
		query: v.string(),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const seed = normalizeSearchTerm(args.query) || normalizeSearchTerm(args.pageTitle);
		const initialRows = (await queryCatalogRows(ctx, {
			limit: 4,
			query: seed,
			shopId: args.shopId,
		})) as CatalogProductRecord[];
		const anchor =
			initialRows.find((row) => row.availableForSale && Boolean(getPrimaryVariant(row))) ??
			initialRows.find((row) => Boolean(getPrimaryVariant(row))) ??
			null;

		if (!anchor) {
			return [];
		}

		const complementSeed = [anchor.vendor, anchor.productType, ...anchor.tags.slice(0, 2)]
			.filter(Boolean)
			.join(" ");
		const complementRows = (await queryCatalogRows(ctx, {
			limit: 6,
			query: complementSeed || seed,
			shopId: args.shopId,
		})) as CatalogProductRecord[];
		const bundleRows = dedupeProducts(
			[anchor, ...complementRows, ...initialRows].filter(
				(row) => row.handle !== anchor.handle || row === anchor,
			),
		)
			.filter((row) => row.handle === anchor.handle || Boolean(getPrimaryVariant(row)))
			.slice(0, 3);

		return bundleRows.map(toProductCard);
	},
});

export const buildCartPlan = internalQuery({
	args: {
		explanation: v.optional(v.string()),
		handles: v.array(v.string()),
		note: v.optional(v.string()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args): Promise<CartPlan | null> => {
		const uniqueHandles = Array.from(new Set(args.handles.map(normalizeHandle))).slice(0, 4);
		const items: CartPlan["items"] = [];

		for (const handle of uniqueHandles) {
			const row = (await ctx.db
				.query("shopifyCatalogProducts")
				.withIndex("by_shop_and_handle", (query) =>
					query.eq("shopId", args.shopId).eq("handle", handle),
				)
				.unique()) as CatalogProductRecord | null;

			if (!row) {
				continue;
			}

			const variant = getPrimaryVariant(row);

			if (!variant || !variant.availableForSale) {
				continue;
			}

			items.push({
				productHandle: row.handle,
				productTitle: row.title,
				productUrl: getProductUrl(row),
				quantity: 1,
				variantId: variant.storefrontVariantId,
				variantTitle: variant.title,
			});
		}

		if (items.length === 0) {
			return null;
		}

		return withoutUndefined({
			explanation: args.explanation?.trim() || undefined,
			items,
			note: args.note?.trim() || undefined,
		});
	},
});

export const consumeRateLimit = internalMutation({
	args: {
		clientFingerprint: v.optional(v.string()),
		sessionId: v.optional(v.string()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const clientResult = args.clientFingerprint
			? await consumeScopeRateLimit(ctx, {
					clientFingerprint: args.clientFingerprint,
					key: args.clientFingerprint,
					limit: CLIENT_LIMIT,
					scope: "client",
					sessionId: args.sessionId,
					shopId: args.shopId,
					windowMs: CLIENT_WINDOW_MS,
				})
			: { allowed: true };
		const sessionResult = args.sessionId
			? await consumeScopeRateLimit(ctx, {
					clientFingerprint: args.clientFingerprint,
					key: args.sessionId,
					limit: SESSION_LIMIT,
					scope: "session",
					sessionId: args.sessionId,
					shopId: args.shopId,
					windowMs: SESSION_WINDOW_MS,
				})
			: { allowed: true };

		if (!clientResult.allowed || !sessionResult.allowed) {
			return {
				allowed: false,
				retryAt:
					("retryAt" in clientResult && clientResult.retryAt) ||
					("retryAt" in sessionResult && sessionResult.retryAt) ||
					null,
			};
		}

		return {
			allowed: true,
			retryAt: null,
		};
	},
});

export const recordEvent = internalMutation({
	args: {
		cardCount: v.number(),
		cartPlanItemCount: v.number(),
		clientFingerprint: v.optional(v.string()),
		outcome: v.union(
			v.literal("answer"),
			v.literal("refusal"),
			v.literal("rate_limited"),
			v.literal("disabled"),
		),
		pageTitle: v.optional(v.string()),
		promptCategory: v.string(),
		promptPreview: v.string(),
		refusalReason: v.optional(v.string()),
		sessionId: v.optional(v.string()),
		shopId: v.id("shops"),
		suggestedPromptCount: v.number(),
		toolNames: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("storefrontAiEvents", {
			cardCount: args.cardCount,
			cartPlanItemCount: args.cartPlanItemCount,
			clientFingerprint: args.clientFingerprint,
			createdAt: Date.now(),
			outcome: args.outcome,
			pageTitle: args.pageTitle,
			promptCategory: args.promptCategory,
			promptPreview: args.promptPreview,
			refusalReason: args.refusalReason,
			sessionId: args.sessionId,
			shopId: args.shopId,
			suggestedPromptCount: args.suggestedPromptCount,
			toolNames: args.toolNames,
		});
	},
});

export const flagModeration = internalMutation({
	args: {
		clientFingerprint: v.optional(v.string()),
		promptPreview: v.string(),
		reason: v.string(),
		sessionId: v.optional(v.string()),
		shopId: v.id("shops"),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const fingerprintKey = args.clientFingerprint ?? args.sessionId ?? "anonymous";
		const existing = await ctx.db
			.query("storefrontAiModerationFlags")
			.withIndex("by_shop_and_fingerprint_key", (query) =>
				query.eq("shopId", args.shopId).eq("fingerprintKey", fingerprintKey),
			)
			.unique();
		const nextReasonCounts = {
			...existing?.reasonCounts,
			[args.reason]: (existing?.reasonCounts?.[args.reason] ?? 0) + 1,
		};

		if (existing) {
			await ctx.db.patch(existing._id, {
				clientFingerprint: args.clientFingerprint,
				lastPromptPreview: args.promptPreview,
				lastTriggeredAt: now,
				reasonCounts: nextReasonCounts,
				sessionId: args.sessionId,
				totalCount: existing.totalCount + 1,
			});

			return existing._id;
		}

		return await ctx.db.insert("storefrontAiModerationFlags", {
			clientFingerprint: args.clientFingerprint,
			createdAt: now,
			fingerprintKey,
			lastPromptPreview: args.promptPreview,
			lastTriggeredAt: now,
			reasonCounts: nextReasonCounts,
			sessionId: args.sessionId,
			shopId: args.shopId,
			totalCount: 1,
		});
	},
});
