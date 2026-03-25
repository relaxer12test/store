import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	auditLogs: defineTable({
		actorId: v.optional(v.string()),
		action: v.string(),
		createdAt: v.number(),
		detail: v.optional(v.string()),
		payload: v.optional(v.any()),
		shopId: v.optional(v.id("shops")),
		status: v.optional(v.string()),
	}).index("by_shop_created_at", ["shopId", "createdAt"]),

	merchantActors: defineTable({
		createdAt: v.number(),
		email: v.optional(v.string()),
		initials: v.string(),
		lastAuthenticatedAt: v.number(),
		name: v.string(),
		sessionId: v.optional(v.string()),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		shopifyUserId: v.string(),
	})
		.index("by_shop", ["shopId"])
		.index("by_shop_and_shopify_user_id", ["shopId", "shopifyUserId"]),

	shops: defineTable({
		createdAt: v.number(),
		domain: v.string(),
		installStatus: v.union(v.literal("pending"), v.literal("connected"), v.literal("inactive")),
		lastAuthenticatedAt: v.optional(v.number()),
		name: v.string(),
		planDisplayName: v.optional(v.string()),
		shopifyShopId: v.optional(v.string()),
	})
		.index("by_domain", ["domain"])
		.index("by_install_status", ["installStatus"]),

	shopifyInstallations: defineTable({
		accessToken: v.optional(v.string()),
		accessTokenExpiresAt: v.optional(v.number()),
		apiVersion: v.string(),
		createdAt: v.number(),
		domain: v.string(),
		lastTokenExchangeAt: v.optional(v.number()),
		refreshToken: v.optional(v.string()),
		refreshTokenExpiresAt: v.optional(v.number()),
		scopes: v.array(v.string()),
		shopId: v.id("shops"),
		status: v.union(
			v.literal("pending"),
			v.literal("connected"),
			v.literal("inactive"),
			v.literal("token_refresh_failed"),
		),
	})
		.index("by_domain", ["domain"])
		.index("by_shop", ["shopId"])
		.index("by_status", ["status"]),

	shopifyCacheStates: defineTable({
		cacheKey: v.string(),
		createdAt: v.number(),
		domain: v.string(),
		enabled: v.boolean(),
		lastCompletedAt: v.optional(v.number()),
		lastError: v.optional(v.string()),
		lastFailedAt: v.optional(v.number()),
		lastReconciledAt: v.optional(v.number()),
		lastRefreshedAt: v.optional(v.number()),
		lastRequestedAt: v.optional(v.number()),
		lastSourceUpdatedAt: v.optional(v.number()),
		lastStartedAt: v.optional(v.number()),
		lastWebhookAt: v.optional(v.number()),
		pendingReason: v.optional(v.string()),
		recordCount: v.optional(v.number()),
		shopId: v.id("shops"),
		staleAfterAt: v.optional(v.number()),
		status: v.string(),
		updatedAt: v.number(),
	})
		.index("by_shop_and_cache_key", ["shopId", "cacheKey"])
		.index("by_shop_and_updated_at", ["shopId", "updatedAt"])
		.index("by_status_and_updated_at", ["status", "updatedAt"]),

	shopifyCatalogProducts: defineTable({
		availableForSale: v.boolean(),
		currencyCode: v.optional(v.string()),
		domain: v.string(),
		handle: v.string(),
		lastRefreshedAt: v.number(),
		maxPrice: v.optional(v.number()),
		minPrice: v.optional(v.number()),
		onlineStoreUrl: v.optional(v.string()),
		productType: v.optional(v.string()),
		publishedAt: v.optional(v.number()),
		searchText: v.string(),
		shopId: v.id("shops"),
		shopifyLegacyProductId: v.optional(v.string()),
		shopifyProductId: v.string(),
		sourceStatus: v.string(),
		sourceUpdatedAt: v.number(),
		summary: v.string(),
		tags: v.array(v.string()),
		title: v.string(),
		variantTitles: v.array(v.string()),
		vendor: v.optional(v.string()),
	})
		.index("by_shop_and_handle", ["shopId", "handle"])
		.index("by_shop_and_last_refreshed_at", ["shopId", "lastRefreshedAt"])
		.index("by_shop_and_shopify_product_id", ["shopId", "shopifyProductId"])
		.index("by_shop_and_source_updated_at", ["shopId", "sourceUpdatedAt"])
		.searchIndex("search_text", {
			filterFields: ["shopId"],
			searchField: "searchText",
		}),

	shopifyMetricsCaches: defineTable({
		activeProductCount: v.number(),
		collectionCount: v.number(),
		createdAt: v.number(),
		domain: v.string(),
		lastOrderAt: v.optional(v.number()),
		lastOrderCurrencyCode: v.optional(v.string()),
		lastOrderFinancialStatus: v.optional(v.string()),
		lastOrderFulfillmentStatus: v.optional(v.string()),
		lastOrderValue: v.optional(v.number()),
		lastRefreshedAt: v.number(),
		locationCount: v.number(),
		productCount: v.number(),
		recentOrderCount: v.number(),
		recentOrderWindowDays: v.number(),
		shopId: v.id("shops"),
		updatedAt: v.number(),
	}).index("by_shop", ["shopId"]),

	syncJobs: defineTable({
		cacheKey: v.optional(v.string()),
		completedAt: v.optional(v.number()),
		domain: v.string(),
		error: v.optional(v.string()),
		jobKey: v.optional(v.string()),
		lastUpdatedAt: v.number(),
		payloadPreview: v.optional(v.string()),
		requestedAt: v.optional(v.number()),
		shopId: v.id("shops"),
		source: v.optional(v.string()),
		startedAt: v.optional(v.number()),
		status: v.string(),
		type: v.string(),
		triggeredByDeliveryId: v.optional(v.id("webhookDeliveries")),
	})
		.index("by_shop_status", ["shopId", "status"])
		.index("by_shop_and_last_updated_at", ["shopId", "lastUpdatedAt"])
		.index("by_shop_and_type_and_status", ["shopId", "type", "status"])
		.index("by_job_key", ["jobKey"]),

	webhookDeliveries: defineTable({
		apiVersion: v.optional(v.string()),
		deliveryKey: v.optional(v.string()),
		domain: v.string(),
		error: v.optional(v.string()),
		eventId: v.optional(v.string()),
		payloadPreview: v.optional(v.string()),
		processedAt: v.optional(v.number()),
		receivedAt: v.number(),
		shopId: v.optional(v.id("shops")),
		status: v.string(),
		topic: v.string(),
		triggeredAt: v.optional(v.string()),
		webhookId: v.optional(v.string()),
	})
		.index("by_delivery_key", ["deliveryKey"])
		.index("by_shop_topic", ["shopId", "topic"])
		.index("by_shop_and_received_at", ["shopId", "receivedAt"])
		.index("by_status_received_at", ["status", "receivedAt"])
		.index("by_domain_received_at", ["domain", "receivedAt"])
		.index("by_event_id", ["eventId"])
		.index("by_webhook_id", ["webhookId"]),

	webhookPayloads: defineTable({
		createdAt: v.number(),
		deliveryId: v.id("webhookDeliveries"),
		payloadPreview: v.string(),
	}).index("by_delivery", ["deliveryId"]),

	widgetConfigs: defineTable({
		accentColor: v.string(),
		createdAt: v.number(),
		enabled: v.boolean(),
		greeting: v.string(),
		knowledgeSources: v.optional(v.array(v.string())),
		position: v.union(v.literal("bottom-right"), v.literal("bottom-left")),
		shopId: v.id("shops"),
		updatedAt: v.number(),
	}).index("by_shop", ["shopId"]),
});
