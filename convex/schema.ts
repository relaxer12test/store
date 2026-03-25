import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
	auditLogs: defineTable({
		actorId: v.optional(v.string()),
		action: v.string(),
		createdAt: v.number(),
		payload: v.optional(v.any()),
		shopId: v.optional(v.id("shops")),
	}).index("by_shop_created_at", ["shopId", "createdAt"]),

	shops: defineTable({
		createdAt: v.number(),
		domain: v.string(),
		installStatus: v.union(v.literal("pending"), v.literal("connected"), v.literal("inactive")),
		name: v.string(),
	}).index("by_domain", ["domain"]),

	syncJobs: defineTable({
		domain: v.string(),
		lastUpdatedAt: v.number(),
		shopId: v.id("shops"),
		status: v.string(),
		type: v.string(),
	}).index("by_shop_status", ["shopId", "status"]),

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
