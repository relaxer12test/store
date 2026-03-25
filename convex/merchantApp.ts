import type { MetricCard, SignalLine, TableRecord } from "../src/shared/contracts/app-shell";
import type { SystemStatusSnapshot } from "../src/shared/contracts/system-status";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireMerchantActor } from "./merchantAuth";

function formatTimestamp(value: number | undefined) {
	if (!value) {
		return "n/a";
	}

	return new Date(value).toISOString();
}

function toShopRecord(
	shop: Doc<"shops">,
	installation?: Doc<"shopifyInstallations"> | null,
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
		merchant_actor_count: "1",
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
	installation,
	shop,
	syncJobCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	installation: Doc<"shopifyInstallations"> | null;
	shop: Doc<"shops">;
	syncJobCount: number;
	webhookDeliveryCount: number;
}): MetricCard[] {
	return [
		{
			label: "Connected shop",
			value: shop.installStatus === "connected" ? "1" : "0",
			delta: shop.domain,
			hint: "Merchant app reads are scoped to the authenticated Shopify shop.",
			tone: shop.installStatus === "connected" ? "success" : "blocked",
		},
		{
			label: "Offline install",
			value: installation?.status === "connected" ? "1" : "0",
			delta: installation?.accessToken ? "Token ready" : "Missing",
			hint: "Backend Shopify access relies on the stored offline Admin API token.",
			tone: installation?.status === "connected" ? "success" : "blocked",
		},
		{
			label: "Sync jobs",
			value: String(syncJobCount),
			delta: syncJobCount > 0 ? "Queued" : "Idle",
			hint: "Only workflows for the authenticated shop are shown here.",
			tone: syncJobCount > 0 ? "accent" : "neutral",
		},
		{
			label: "Webhook deliveries",
			value: String(webhookDeliveryCount),
			delta: webhookDeliveryCount > 0 ? "Recorded" : "None yet",
			hint: "Webhook visibility is limited to the authenticated shop context.",
			tone: webhookDeliveryCount > 0 ? "success" : "watch",
		},
		{
			label: "Action audits",
			value: String(auditLogCount),
			delta: auditLogCount > 0 ? "Recorded" : "None yet",
			hint: "Approvals and Shopify-side effects must be audited against this merchant actor and shop.",
			tone: auditLogCount > 0 ? "accent" : "watch",
		},
	];
}

function buildSignals({
	auditLogCount,
	installation,
	shop,
	syncJobCount,
	webhookDeliveryCount,
	widgetConfigExists,
}: {
	auditLogCount: number;
	installation: Doc<"shopifyInstallations"> | null;
	shop: Doc<"shops">;
	syncJobCount: number;
	webhookDeliveryCount: number;
	widgetConfigExists: boolean;
}): SignalLine[] {
	return [
		{
			label: "Authenticated shop context",
			detail: `Protected merchant queries now resolve the active shop as ${shop.name} (${shop.domain}).`,
			tone: "success",
		},
		{
			label: "Offline Admin API credentials",
			detail: installation?.accessToken
				? "A stored offline Admin API token exists for this shop."
				: "No stored offline Admin API token exists for this shop yet.",
			tone: installation?.accessToken ? "success" : "blocked",
		},
		{
			label: "Widget configuration",
			detail: widgetConfigExists
				? "A storefront widget configuration row exists for this shop."
				: "The storefront widget configuration row has not been created for this shop yet.",
			tone: widgetConfigExists ? "success" : "watch",
		},
		{
			label: "Webhook ingestion",
			detail:
				webhookDeliveryCount > 0
					? `${webhookDeliveryCount} webhook delivery record(s) exist for this shop.`
					: "No webhook delivery has been recorded for this shop yet.",
			tone: webhookDeliveryCount > 0 ? "success" : "watch",
		},
		{
			label: "Async workflows",
			detail:
				syncJobCount > 0
					? `${syncJobCount} workflow row(s) exist for this shop.`
					: "No workflow rows exist for this shop yet.",
			tone: syncJobCount > 0 ? "accent" : "watch",
		},
		{
			label: "Merchant audit trail",
			detail:
				auditLogCount > 0
					? `${auditLogCount} audit log row(s) exist for this shop.`
					: "No audit logs exist for this shop yet.",
			tone: auditLogCount > 0 ? "accent" : "watch",
		},
	];
}

function buildBlockers({
	auditLogCount,
	installation,
	shop,
	syncJobCount,
	webhookDeliveryCount,
	widgetConfigExists,
}: {
	auditLogCount: number;
	installation: Doc<"shopifyInstallations"> | null;
	shop: Doc<"shops">;
	syncJobCount: number;
	webhookDeliveryCount: number;
	widgetConfigExists: boolean;
}) {
	return [
		shop.installStatus !== "connected"
			? "This shop is not marked connected, so protected merchant actions should stay blocked."
			: null,
		!installation?.accessToken
			? "No offline Admin API token exists for the authenticated shop."
			: null,
		!widgetConfigExists
			? "No storefront widget configuration exists for the authenticated shop yet."
			: null,
		webhookDeliveryCount === 0
			? "No webhook deliveries have been recorded for this shop yet."
			: null,
		syncJobCount === 0 ? "No workflow or sync rows exist for this shop yet." : null,
		auditLogCount === 0 ? "No audit trail exists for this shop yet." : null,
	].filter((value): value is string => value !== null);
}

export const snapshot = query({
	args: {},
	handler: async (ctx): Promise<SystemStatusSnapshot> => {
		const { shop } = await requireMerchantActor(ctx);
		const [installation, widgetConfig, syncJobs, webhookDeliveries, auditLogs] = await Promise.all([
			ctx.db
				.query("shopifyInstallations")
				.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
				.unique(),
			ctx.db
				.query("widgetConfigs")
				.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
				.unique(),
			ctx.db
				.query("syncJobs")
				.withIndex("by_shop_and_last_updated_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(50),
			ctx.db
				.query("webhookDeliveries")
				.withIndex("by_shop_and_received_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(50),
			ctx.db
				.query("auditLogs")
				.withIndex("by_shop_created_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(50),
		]);

		return {
			metrics: buildMetrics({
				auditLogCount: auditLogs.length,
				installation,
				shop,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			signals: buildSignals({
				auditLogCount: auditLogs.length,
				installation,
				shop,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
				widgetConfigExists: Boolean(widgetConfig),
			}),
			blockers: buildBlockers({
				auditLogCount: auditLogs.length,
				installation,
				shop,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
				widgetConfigExists: Boolean(widgetConfig),
			}),
			shops: [toShopRecord(shop, installation)],
			syncJobs: syncJobs.map(toSyncJobRecord),
			webhookDeliveries: webhookDeliveries.map(toWebhookDeliveryRecord),
			auditLogs: auditLogs.map(toAuditLogRecord),
		};
	},
});
