import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	auditLogs: defineTable({
		actorId: v.optional(v.string()),
		action: v.string(),
		createdAt: v.number(),
		payload: v.optional(v.any()),
		tenantId: v.optional(v.id("tenants")),
	}).index("by_tenant_created_at", ["tenantId", "createdAt"]),

	shops: defineTable({
		createdAt: v.number(),
		domain: v.string(),
		installStatus: v.union(v.literal("preview"), v.literal("connected"), v.literal("inactive")),
		name: v.string(),
		tenantId: v.id("tenants"),
	})
		.index("by_domain", ["domain"])
		.index("by_tenant", ["tenantId"]),

	syncJobs: defineTable({
		domain: v.string(),
		lastUpdatedAt: v.number(),
		shopId: v.id("shops"),
		status: v.string(),
		type: v.string(),
	}).index("by_shop_status", ["shopId", "status"]),

	tenants: defineTable({
		createdAt: v.number(),
		displayName: v.string(),
		slug: v.string(),
	}).index("by_slug", ["slug"]),

	webhookDeliveries: defineTable({
		receivedAt: v.number(),
		shopId: v.id("shops"),
		status: v.string(),
		topic: v.string(),
		webhookId: v.optional(v.string()),
	})
		.index("by_shop_topic", ["shopId", "topic"])
		.index("by_status_received_at", ["status", "receivedAt"]),
});
