import type { MetricCard, SignalLine, TableRecord } from "../src/shared/contracts/app-shell";
import type { SystemStatusSnapshot } from "../src/shared/contracts/system-status";
import { components } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireAdmin } from "./auth";

interface BetterAuthOrganizationSnapshot {
	_id?: string;
	id: string;
	shopId: string;
}

interface BetterAuthMemberSnapshot {
	_id?: string;
	id: string;
	organizationId: string;
}

function getAuthRecordId(record: { _id?: string; id?: string }) {
	return record.id ?? record._id ?? "";
}

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
		member_count: String(actorCount),
	};
}

function toSyncJobRecord(syncJob: Doc<"syncJobs">): TableRecord {
	return {
		cache_key: syncJob.cacheKey ?? "n/a",
		completed_at: formatTimestamp(syncJob.completedAt),
		id: syncJob._id,
		domain: syncJob.domain,
		error: syncJob.error ?? "n/a",
		last_updated_at: formatTimestamp(syncJob.lastUpdatedAt),
		requested_at: formatTimestamp(syncJob.requestedAt),
		shop_id: syncJob.shopId,
		started_at: formatTimestamp(syncJob.startedAt),
		status: syncJob.status,
		type: syncJob.type,
	};
}

function toWebhookDeliveryRecord(webhookDelivery: Doc<"webhookDeliveries">): TableRecord {
	return {
		delivery_key: webhookDelivery.deliveryKey ?? "n/a",
		error: webhookDelivery.error ?? "n/a",
		id: webhookDelivery._id,
		processed_at: formatTimestamp(webhookDelivery.processedAt),
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

function toCacheStateRecord(cacheState: Doc<"shopifyCacheStates">): TableRecord {
	return {
		id: cacheState._id,
		cache_key: cacheState.cacheKey,
		last_completed_at: formatTimestamp(cacheState.lastCompletedAt),
		last_error: cacheState.lastError ?? "n/a",
		last_requested_at: formatTimestamp(cacheState.lastRequestedAt),
		last_webhook_at: formatTimestamp(cacheState.lastWebhookAt),
		record_count: String(cacheState.recordCount ?? 0),
		status: cacheState.status,
	};
}

function buildMetrics({
	auditLogCount,
	cacheStateCount,
	connectedShopCount,
	connectedInstallationCount,
	shopCount,
	syncJobCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	cacheStateCount: number;
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
			label: "Cache states",
			value: String(cacheStateCount),
			delta: cacheStateCount > 0 ? "Tracked" : "Missing",
			hint: "Cache state rows track freshness, errors, and webhook-to-refresh lag for Shopify-backed projections.",
			tone: cacheStateCount > 0 ? "accent" : "watch",
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
	cacheStateCount,
	connectedShopCount,
	connectedInstallationCount,
	merchantMemberCount,
	shopCount,
	syncJobCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	cacheStateCount: number;
	connectedShopCount: number;
	connectedInstallationCount: number;
	merchantMemberCount: number;
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
			label: "Merchant memberships",
			detail:
				merchantMemberCount > 0
					? `${merchantMemberCount} Better Auth organization member record(s) exist for embedded merchants.`
					: "No embedded merchant organization membership exists yet.",
			tone: merchantMemberCount > 0 ? "success" : "watch",
		},
		{
			label: "Cache freshness tracking",
			detail:
				cacheStateCount > 0
					? `${cacheStateCount} cache state row(s) currently track refresh freshness and failures.`
					: "No cache state rows exist yet, so stale-cache diagnostics are unavailable.",
			tone: cacheStateCount > 0 ? "success" : "watch",
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
	cacheStateCount,
	connectedShopCount,
	connectedInstallationCount,
	merchantMemberCount,
	shopCount,
	syncJobCount,
	widgetConfigCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	cacheStateCount: number;
	connectedShopCount: number;
	connectedInstallationCount: number;
	merchantMemberCount: number;
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
		shopCount > 0 && merchantMemberCount === 0
			? "No Better Auth merchant membership has authenticated through a verified embedded session yet."
			: null,
		shopCount > 0 && widgetConfigCount === 0
			? "No widget configuration row exists yet for the connected shop."
			: null,
		shopCount > 0 && cacheStateCount === 0
			? "No Shopify cache state row exists yet, so freshness diagnostics remain blind."
			: null,
		webhookDeliveryCount === 0 ? "No real webhook deliveries have been ingested yet." : null,
		syncJobCount === 0 ? "No sync workflow has run yet." : null,
		auditLogCount === 0 ? "No merchant action audit trail has been recorded yet." : null,
	].filter((value): value is string => value !== null);
}

export const snapshot = query({
	args: {},
	handler: async (ctx): Promise<SystemStatusSnapshot> => {
		await requireAdmin(ctx);

		const [
			shops,
			installations,
			organizations,
			members,
			widgetConfigs,
			cacheStates,
			syncJobs,
			webhookDeliveries,
			auditLogs,
		] = await Promise.all([
			ctx.db.query("shops").take(50),
			ctx.db.query("shopifyInstallations").take(50),
			ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "organization",
				paginationOpts: {
					cursor: null,
					numItems: 200,
				},
			}) as Promise<{ page: BetterAuthOrganizationSnapshot[] }>,
			ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "member",
				paginationOpts: {
					cursor: null,
					numItems: 200,
				},
			}) as Promise<{ page: BetterAuthMemberSnapshot[] }>,
			ctx.db.query("widgetConfigs").take(50),
			ctx.db.query("shopifyCacheStates").take(50),
			ctx.db.query("syncJobs").take(50),
			ctx.db.query("webhookDeliveries").take(50),
			ctx.db.query("auditLogs").take(50),
		]);

		const installationByShopId = new Map(
			installations.map((installation) => [installation.shopId, installation]),
		);
		const shopIdByOrganizationId = new Map(
			organizations.page.map((organization) => [
				getAuthRecordId(organization),
				organization.shopId,
			]),
		);
		const actorCountByShopId = members.page.reduce<Map<Doc<"shops">["_id"], number>>(
			(map, member) => {
				const shopId = shopIdByOrganizationId.get(member.organizationId);

				if (shopId) {
					map.set(shopId as Doc<"shops">["_id"], (map.get(shopId as Doc<"shops">["_id"]) ?? 0) + 1);
				}

				return map;
			},
			new Map(),
		);
		const connectedInstallationCount = installations.filter(
			(installation) => installation.status === "connected",
		).length;
		const merchantMemberCount = members.page.length;
		const widgetConfigCount = widgetConfigs.length;
		const connectedShopCount = shops.filter((shop) => shop.installStatus === "connected").length;

		return {
			metrics: buildMetrics({
				auditLogCount: auditLogs.length,
				cacheStateCount: cacheStates.length,
				connectedInstallationCount,
				connectedShopCount,
				shopCount: shops.length,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			signals: buildSignals({
				auditLogCount: auditLogs.length,
				cacheStateCount: cacheStates.length,
				connectedInstallationCount,
				connectedShopCount,
				merchantMemberCount,
				shopCount: shops.length,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			blockers: buildBlockers({
				auditLogCount: auditLogs.length,
				cacheStateCount: cacheStates.length,
				connectedInstallationCount,
				connectedShopCount,
				merchantMemberCount,
				shopCount: shops.length,
				syncJobCount: syncJobs.length,
				widgetConfigCount,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			shops: sortByNumberDesc(shops, (shop) => shop.createdAt).map((shop) =>
				toShopRecord(shop, installationByShopId.get(shop._id), actorCountByShopId.get(shop._id)),
			),
			cacheStates: sortByNumberDesc(cacheStates, (cacheState) => cacheState.updatedAt).map(
				toCacheStateRecord,
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
