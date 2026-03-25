import type { MetricCard, SignalLine, TableRecord } from "../src/shared/contracts/app-shell";
import type { SystemStatusSnapshot } from "../src/shared/contracts/system-status";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";

function formatTimestamp(value: number | undefined) {
	if (!value) {
		return "n/a";
	}

	return new Date(value).toISOString();
}

function sortByNumberDesc<T>(items: T[], getValue: (item: T) => number | undefined) {
	return [...items].sort((left, right) => (getValue(right) ?? 0) - (getValue(left) ?? 0));
}

function toShopRecord(shop: Doc<"shops">): TableRecord {
	return {
		id: shop._id,
		created_at: formatTimestamp(shop.createdAt),
		domain: shop.domain,
		install_status: shop.installStatus,
		name: shop.name,
	};
}

function toSyncJobRecord(syncJob: Doc<"syncJobs">): TableRecord {
	return {
		id: syncJob._id,
		domain: syncJob.domain,
		last_updated_at: formatTimestamp(syncJob.lastUpdatedAt),
		shop_id: syncJob.shopId,
		status: syncJob.status,
		type: syncJob.type,
	};
}

function toWebhookDeliveryRecord(webhookDelivery: Doc<"webhookDeliveries">): TableRecord {
	return {
		id: webhookDelivery._id,
		received_at: formatTimestamp(webhookDelivery.receivedAt),
		shop_id: webhookDelivery.shopId,
		status: webhookDelivery.status,
		topic: webhookDelivery.topic,
		webhook_id: webhookDelivery.webhookId ?? "n/a",
	};
}

function toAuditLogRecord(auditLog: Doc<"auditLogs">): TableRecord {
	return {
		id: auditLog._id,
		action: auditLog.action,
		actor_id: auditLog.actorId ?? "n/a",
		created_at: formatTimestamp(auditLog.createdAt),
		shop_id: auditLog.shopId ?? "n/a",
	};
}

function buildMetrics({
	auditLogCount,
	connectedShopCount,
	shopCount,
	syncJobCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	connectedShopCount: number;
	shopCount: number;
	syncJobCount: number;
	webhookDeliveryCount: number;
}): MetricCard[] {
	return [
		{
			label: "Connected shops",
			value: String(connectedShopCount),
			delta: shopCount === 0 ? "Missing" : `${shopCount} total`,
			hint: "These numbers come from the actual `shops` table in Convex, not a demo fixture.",
			tone: connectedShopCount > 0 ? "success" : "blocked",
		},
		{
			label: "Webhook deliveries",
			value: String(webhookDeliveryCount),
			delta: webhookDeliveryCount > 0 ? "Recorded" : "None yet",
			hint: "Inbound webhook diagnostics only show deliveries that have really been stored.",
			tone: webhookDeliveryCount > 0 ? "success" : "watch",
		},
		{
			label: "Sync jobs",
			value: String(syncJobCount),
			delta: syncJobCount > 0 ? "Queued" : "Idle",
			hint: "Workflow state is derived from the `syncJobs` table as it exists right now.",
			tone: syncJobCount > 0 ? "accent" : "neutral",
		},
		{
			label: "Action audits",
			value: String(auditLogCount),
			delta: auditLogCount > 0 ? "Recorded" : "None yet",
			hint: "Merchant action traces stay empty until real approval and mutation logging is wired.",
			tone: auditLogCount > 0 ? "accent" : "watch",
		},
	];
}

function buildSignals({
	auditLogCount,
	connectedShopCount,
	shopCount,
	syncJobCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	connectedShopCount: number;
	shopCount: number;
	syncJobCount: number;
	webhookDeliveryCount: number;
}): SignalLine[] {
	return [
		{
			label: "Shop installation records",
			detail:
				shopCount > 0
					? `${shopCount} shop record(s) exist in Convex and ${connectedShopCount} are marked connected.`
					: "No shop installation records exist in Convex yet.",
			tone: shopCount > 0 ? "success" : "blocked",
		},
		{
			label: "Webhook ingestion",
			detail:
				webhookDeliveryCount > 0
					? `${webhookDeliveryCount} webhook delivery record(s) have been stored.`
					: "No webhook deliveries have been stored yet.",
			tone: webhookDeliveryCount > 0 ? "success" : "watch",
		},
		{
			label: "Async workflows",
			detail:
				syncJobCount > 0
					? `${syncJobCount} sync job record(s) exist in Convex.`
					: "No sync jobs exist yet, so workflows are not wired to real Shopify activity.",
			tone: syncJobCount > 0 ? "accent" : "watch",
		},
		{
			label: "Merchant audit trail",
			detail:
				auditLogCount > 0
					? `${auditLogCount} audit log record(s) exist in Convex.`
					: "No merchant action audits exist yet.",
			tone: auditLogCount > 0 ? "accent" : "watch",
		},
	];
}

function buildBlockers({
	auditLogCount,
	connectedShopCount,
	shopCount,
	syncJobCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	connectedShopCount: number;
	shopCount: number;
	syncJobCount: number;
	webhookDeliveryCount: number;
}) {
	return [
		shopCount === 0 ? "No Shopify installation record exists in Convex yet." : null,
		shopCount > 0 && connectedShopCount === 0
			? "A shop record exists, but nothing is marked `connected` yet."
			: null,
		webhookDeliveryCount === 0 ? "No real webhook deliveries have been ingested yet." : null,
		syncJobCount === 0 ? "No sync workflow has run yet." : null,
		auditLogCount === 0 ? "No merchant action audit trail has been recorded yet." : null,
	].filter((value): value is string => value !== null);
}

export const snapshot = query({
	args: {},
	handler: async (ctx): Promise<SystemStatusSnapshot> => {
		const [shops, syncJobs, webhookDeliveries, auditLogs] = await Promise.all([
			ctx.db.query("shops").collect(),
			ctx.db.query("syncJobs").collect(),
			ctx.db.query("webhookDeliveries").collect(),
			ctx.db.query("auditLogs").collect(),
		]);

		const connectedShopCount = shops.filter((shop) => shop.installStatus === "connected").length;

		return {
			metrics: buildMetrics({
				auditLogCount: auditLogs.length,
				connectedShopCount,
				shopCount: shops.length,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			signals: buildSignals({
				auditLogCount: auditLogs.length,
				connectedShopCount,
				shopCount: shops.length,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			blockers: buildBlockers({
				auditLogCount: auditLogs.length,
				connectedShopCount,
				shopCount: shops.length,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			shops: sortByNumberDesc(shops, (shop) => shop.createdAt).map(toShopRecord),
			syncJobs: sortByNumberDesc(syncJobs, (syncJob) => syncJob.lastUpdatedAt).map(toSyncJobRecord),
			webhookDeliveries: sortByNumberDesc(
				webhookDeliveries,
				(webhookDelivery) => webhookDelivery.receivedAt,
			).map(toWebhookDeliveryRecord),
			auditLogs: sortByNumberDesc(auditLogs, (auditLog) => auditLog.createdAt).map(
				toAuditLogRecord,
			),
		};
	},
});
