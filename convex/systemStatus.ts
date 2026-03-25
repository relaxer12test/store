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

function toShopRecord(
	shop: Doc<"shops">,
	installation?: Doc<"shopifyInstallations">,
	actorCount = 0,
): TableRecord {
	return {
		id: shop._id,
		created_at: formatTimestamp(shop.createdAt),
		domain: shop.domain,
		install_status: shop.installStatus,
		last_authenticated_at: formatTimestamp(shop.lastAuthenticatedAt),
		last_token_exchange_at: formatTimestamp(installation?.lastTokenExchangeAt),
		name: shop.name,
		scope_count: String(installation?.scopes.length ?? 0),
		token_status: installation?.status ?? "missing",
		merchant_actor_count: String(actorCount),
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
		shop_id: webhookDelivery.shopId ?? "n/a",
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
		status: auditLog.status ?? "n/a",
		shop_id: auditLog.shopId ?? "n/a",
	};
}

function buildMetrics({
	auditLogCount,
	connectedShopCount,
	connectedInstallationCount,
	shopCount,
	syncJobCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	connectedShopCount: number;
	connectedInstallationCount: number;
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
			label: "Offline installs",
			value: String(connectedInstallationCount),
			delta: connectedInstallationCount > 0 ? "Token ready" : "Missing",
			hint: "A connected install means Convex has stored a Shopify offline token for the shop.",
			tone: connectedInstallationCount > 0 ? "success" : "blocked",
		},
		{
			label: "Sync jobs",
			value: String(syncJobCount),
			delta: syncJobCount > 0 ? "Queued" : "Idle",
			hint: "Workflow state is derived from the `syncJobs` table as it exists right now.",
			tone: syncJobCount > 0 ? "accent" : "neutral",
		},
		{
			label: "Webhook deliveries",
			value: String(webhookDeliveryCount),
			delta: webhookDeliveryCount > 0 ? "Recorded" : "None yet",
			hint: "Inbound webhook diagnostics only show deliveries that have really been stored.",
			tone: webhookDeliveryCount > 0 ? "success" : "watch",
		},
		{
			label: "Action audits",
			value: String(auditLogCount),
			delta: auditLogCount > 0 ? "Recorded" : "None yet",
			hint: "Bootstrap, webhook, and future approval flows all land in the audit table.",
			tone: auditLogCount > 0 ? "accent" : "watch",
		},
	];
}

function buildSignals({
	auditLogCount,
	connectedShopCount,
	connectedInstallationCount,
	merchantActorCount,
	shopCount,
	syncJobCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	connectedShopCount: number;
	connectedInstallationCount: number;
	merchantActorCount: number;
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
			label: "Offline token lifecycle",
			detail:
				connectedInstallationCount > 0
					? `${connectedInstallationCount} installation record(s) have an active offline token state.`
					: "No connected Shopify installation token record exists yet.",
			tone: connectedInstallationCount > 0 ? "success" : "blocked",
		},
		{
			label: "Merchant actors",
			detail:
				merchantActorCount > 0
					? `${merchantActorCount} merchant actor record(s) have authenticated through the embedded app.`
					: "No merchant actor has been created from a real embedded session yet.",
			tone: merchantActorCount > 0 ? "success" : "watch",
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
	connectedInstallationCount,
	merchantActorCount,
	shopCount,
	syncJobCount,
	widgetConfigCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	connectedShopCount: number;
	connectedInstallationCount: number;
	merchantActorCount: number;
	shopCount: number;
	syncJobCount: number;
	widgetConfigCount: number;
	webhookDeliveryCount: number;
}) {
	return [
		shopCount === 0 ? "No Shopify installation record exists in Convex yet." : null,
		shopCount > 0 && connectedShopCount === 0
			? "A shop record exists, but nothing is marked `connected` yet."
			: null,
		shopCount > 0 && connectedInstallationCount === 0
			? "A shop record exists, but there is still no stored offline Admin API token."
			: null,
		shopCount > 0 && merchantActorCount === 0
			? "No merchant actor has authenticated through a verified embedded session yet."
			: null,
		shopCount > 0 && widgetConfigCount === 0
			? "No widget configuration row exists yet for the connected shop."
			: null,
		webhookDeliveryCount === 0 ? "No real webhook deliveries have been ingested yet." : null,
		syncJobCount === 0 ? "No sync workflow has run yet." : null,
		auditLogCount === 0 ? "No merchant action audit trail has been recorded yet." : null,
	].filter((value): value is string => value !== null);
}

export const snapshot = query({
	args: {},
	handler: async (ctx): Promise<SystemStatusSnapshot> => {
		const [
			shops,
			installations,
			merchantActors,
			widgetConfigs,
			syncJobs,
			webhookDeliveries,
			auditLogs,
		] = await Promise.all([
			ctx.db.query("shops").take(50),
			ctx.db.query("shopifyInstallations").take(50),
			ctx.db.query("merchantActors").take(50),
			ctx.db.query("widgetConfigs").take(50),
			ctx.db.query("syncJobs").take(50),
			ctx.db.query("webhookDeliveries").take(50),
			ctx.db.query("auditLogs").take(50),
		]);

		const installationByShopId = new Map(
			installations.map((installation) => [installation.shopId, installation]),
		);
		const actorCountByShopId = merchantActors.reduce<Map<Doc<"shops">["_id"], number>>(
			(map, actor) => {
				map.set(actor.shopId, (map.get(actor.shopId) ?? 0) + 1);

				return map;
			},
			new Map(),
		);
		const connectedInstallationCount = installations.filter(
			(installation) => installation.status === "connected",
		).length;
		const merchantActorCount = merchantActors.length;
		const widgetConfigCount = widgetConfigs.length;
		const connectedShopCount = shops.filter((shop) => shop.installStatus === "connected").length;

		return {
			metrics: buildMetrics({
				auditLogCount: auditLogs.length,
				connectedInstallationCount,
				connectedShopCount,
				shopCount: shops.length,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			signals: buildSignals({
				auditLogCount: auditLogs.length,
				connectedInstallationCount,
				connectedShopCount,
				merchantActorCount,
				shopCount: shops.length,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			blockers: buildBlockers({
				auditLogCount: auditLogs.length,
				connectedInstallationCount,
				connectedShopCount,
				merchantActorCount,
				shopCount: shops.length,
				syncJobCount: syncJobs.length,
				widgetConfigCount,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			shops: sortByNumberDesc(shops, (shop) => shop.createdAt).map((shop) =>
				toShopRecord(shop, installationByShopId.get(shop._id), actorCountByShopId.get(shop._id)),
			),
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
