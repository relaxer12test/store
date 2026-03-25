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
	}).index("by_domain", ["domain"]),

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
		.index("by_shop", ["shopId"]),

	syncJobs: defineTable({
		domain: v.string(),
		lastUpdatedAt: v.number(),
		payloadPreview: v.optional(v.string()),
		shopId: v.id("shops"),
		source: v.optional(v.string()),
		status: v.string(),
		type: v.string(),
	})
		.index("by_shop_status", ["shopId", "status"])
		.index("by_shop_and_last_updated_at", ["shopId", "lastUpdatedAt"]),

	webhookDeliveries: defineTable({
		apiVersion: v.optional(v.string()),
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
		.index("by_shop_topic", ["shopId", "topic"])
		.index("by_shop_and_received_at", ["shopId", "receivedAt"])
		.index("by_status_received_at", ["status", "receivedAt"])
		.index("by_domain_received_at", ["domain", "receivedAt"])
		.index("by_event_id", ["eventId"])
		.index("by_webhook_id", ["webhookId"]),

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
