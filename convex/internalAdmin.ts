import { components } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { query, type QueryCtx } from "@convex/_generated/server";
import { requireAdmin } from "@convex/auth";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import type {
	InternalAiSessionDetailData,
	InternalAiSessionsListData,
	InternalAiSessionSummary,
	InternalAiTranscriptMessage,
	InternalAiTranscriptPageData,
	InternalAuditDetailData,
	InternalAuditsListData,
	InternalAuditSummary,
	InternalCacheStateDetailData,
	InternalCacheStatesListData,
	InternalCacheStateSummary,
	InternalPageInfo,
	InternalShopDetailData,
	InternalShopsListData,
	InternalShopSummary,
	InternalUserDetailData,
	InternalUsersListData,
	InternalUserMembershipSummary,
	InternalUserSessionSummary,
	InternalUserSummary,
	InternalWebhookDetailData,
	InternalWebhookDeliverySummary,
	InternalWebhookPayloadSummary,
	InternalWebhooksListData,
	InternalWorkflowDetailData,
	InternalWorkflowLog,
	InternalWorkflowSummary,
	InternalWorkflowsListData,
} from "@/shared/contracts/internal-admin";

interface BetterAuthPage<TRecord> {
	continueCursor: string;
	isDone: boolean;
	page: TRecord[];
}

interface BetterAuthOrganizationRecord {
	_id?: string;
	id?: string;
	shopDomain?: string | null;
	shopId?: string | null;
}

interface BetterAuthMemberRecord {
	_id?: string;
	id?: string;
	organizationId: string;
	role?: string | null;
	userId: string;
}

interface BetterAuthSessionRecord {
	_id?: string;
	activeOrganizationId?: string | null;
	createdAt?: number | null;
	expiresAt?: number | null;
	id?: string;
	updatedAt?: number | null;
	userId: string;
}

interface BetterAuthUserRecord {
	_id?: string;
	banned?: boolean | null;
	createdAt?: number | null;
	email: string;
	id?: string;
	name: string;
	role?: string | null;
	updatedAt?: number | null;
}

const SORT_DIRECTION_VALIDATOR = v.union(v.literal("asc"), v.literal("desc"));
const SHOP_STATUS_VALIDATOR = v.optional(
	v.union(v.literal("connected"), v.literal("inactive"), v.literal("pending")),
);

function formatTimestamp(value: number | null | undefined) {
	return typeof value === "number" ? new Date(value).toISOString() : null;
}

function formatPageInfo(result: { continueCursor: string; isDone: boolean }): InternalPageInfo {
	return {
		continueCursor: result.isDone ? null : result.continueCursor,
		isDone: result.isDone,
	};
}

function getAuthRecordId(record: { _id?: string; id?: string }) {
	return record.id ?? record._id ?? "";
}

function prefixUpperBound(value: string) {
	return `${value}\uffff`;
}

function normalizePrefix(value: string | undefined) {
	const trimmed = value?.trim();

	return trimmed ? trimmed : null;
}

function formatJson(value: unknown) {
	if (value === null || value === undefined) {
		return null;
	}

	try {
		return JSON.stringify(value, null, 2);
	} catch {
		return "[unserializable value]";
	}
}

function getReplyPreview(reply: Doc<"storefrontAiSessions">["lastReply"] | undefined) {
	const answer = reply?.answer?.trim();

	return answer ? answer.slice(0, 280) : null;
}

function getReplyTone(reply: Doc<"storefrontAiSessions">["lastReply"] | undefined) {
	return reply?.tone ?? null;
}

function getRefusalReason(reply: Doc<"storefrontAiSessions">["lastReply"] | undefined) {
	return reply?.refusalReason ?? null;
}

function toShopSummary(
	shop: Doc<"shops">,
	installation: Doc<"shopifyInstallations"> | null,
): InternalShopSummary {
	return {
		createdAt: formatTimestamp(shop.createdAt) ?? new Date(0).toISOString(),
		domain: shop.domain,
		id: shop._id,
		installStatus: shop.installStatus,
		lastAuthenticatedAt: formatTimestamp(shop.lastAuthenticatedAt),
		lastTokenExchangeAt: formatTimestamp(installation?.lastTokenExchangeAt),
		name: shop.name,
		planDisplayName: shop.planDisplayName ?? null,
		shopifyShopId: shop.shopifyShopId ?? null,
		tokenStatus: installation?.status ?? null,
	};
}

function toCacheStateSummary(record: Doc<"shopifyCacheStates">): InternalCacheStateSummary {
	return {
		cacheKey: record.cacheKey,
		domain: record.domain,
		id: record._id,
		lastCompletedAt: formatTimestamp(record.lastCompletedAt),
		lastRequestedAt: formatTimestamp(record.lastRequestedAt),
		lastWebhookAt: formatTimestamp(record.lastWebhookAt),
		recordCount: record.recordCount ?? 0,
		shopId: record.shopId,
		status: record.status,
		updatedAt: formatTimestamp(record.updatedAt) ?? new Date(0).toISOString(),
	};
}

function toWorkflowSummary(record: Doc<"syncJobs">): InternalWorkflowSummary {
	return {
		cacheKey: record.cacheKey ?? null,
		completedAt: formatTimestamp(record.completedAt),
		domain: record.domain,
		error: record.error ?? null,
		id: record._id,
		lastUpdatedAt: formatTimestamp(record.lastUpdatedAt) ?? new Date(0).toISOString(),
		payloadPreview: record.payloadPreview ?? null,
		requestedAt: formatTimestamp(record.requestedAt),
		retryCount: record.retryCount ?? 0,
		shopId: record.shopId,
		source: record.source ?? null,
		startedAt: formatTimestamp(record.startedAt),
		status: record.status,
		type: record.type,
	};
}

function toWebhookSummary(record: Doc<"webhookDeliveries">): InternalWebhookDeliverySummary {
	return {
		deliveryKey: record.deliveryKey ?? null,
		domain: record.domain,
		error: record.error ?? null,
		id: record._id,
		processedAt: formatTimestamp(record.processedAt),
		receivedAt: formatTimestamp(record.receivedAt) ?? new Date(0).toISOString(),
		shopId: record.shopId ?? null,
		status: record.status,
		topic: record.topic,
		webhookId: record.webhookId ?? null,
	};
}

function toAuditSummary(record: Doc<"auditLogs">): InternalAuditSummary {
	return {
		action: record.action,
		actorId: record.actorId ?? null,
		createdAt: formatTimestamp(record.createdAt) ?? new Date(0).toISOString(),
		detail: record.detail ?? null,
		id: record._id,
		shopId: record.shopId ?? null,
		status: record.status ?? null,
	};
}

function toAiSessionSummary(
	record: Doc<"storefrontAiSessions">,
	shop: Doc<"shops"> | null,
): InternalAiSessionSummary {
	return {
		clientFingerprint: record.clientFingerprint ?? null,
		createdAt: formatTimestamp(record.createdAt) ?? new Date(0).toISOString(),
		id: record._id,
		lastPromptAt: formatTimestamp(record.lastPromptAt) ?? new Date(0).toISOString(),
		lastPromptPreview: record.lastPromptPreview ?? null,
		lastRefusalReason: getRefusalReason(record.lastReply),
		lastReplyAt: formatTimestamp(record.lastReplyAt),
		lastReplyPreview: getReplyPreview(record.lastReply),
		lastReplyTone: getReplyTone(record.lastReply),
		sessionId: record.sessionId,
		shopDomain: shop?.domain ?? "unknown",
		shopId: record.shopId,
		shopName: shop?.name ?? "Unknown shop",
		threadId: record.threadId,
		updatedAt: formatTimestamp(record.updatedAt) ?? new Date(0).toISOString(),
	};
}

function toUserSummary(record: BetterAuthUserRecord): InternalUserSummary {
	return {
		banned: Boolean(record.banned),
		createdAt: formatTimestamp(record.createdAt ?? null),
		email: record.email,
		id: getAuthRecordId(record),
		name: record.name,
		role: record.role ?? null,
		updatedAt: formatTimestamp(record.updatedAt ?? null),
	};
}

function toSessionTranscriptMessage(
	message: Doc<"storefrontAiSessionMessages">,
): InternalAiTranscriptMessage {
	return {
		body: message.body,
		createdAt: new Date(message.createdAt).toISOString(),
		error: null,
		id: message._id,
		model: null,
		order: message.createdAt,
		provider: null,
		role: message.role,
		status: "success",
		stepOrder: 1,
	};
}

async function readShopMap(ctx: QueryCtx, shopIds: readonly Id<"shops">[]) {
	const uniqueShopIds = Array.from(new Set(shopIds));
	const shops = await Promise.all(uniqueShopIds.map((shopId) => ctx.db.get(shopId)));

	return new Map(uniqueShopIds.map((shopId, index) => [shopId, shops[index] ?? null]));
}

async function readInstallationMap(ctx: QueryCtx, shopIds: readonly Id<"shops">[]) {
	const installations = await Promise.all(
		Array.from(new Set(shopIds)).map(async (shopId) => {
			const installation = await ctx.db
				.query("shopifyInstallations")
				.withIndex("by_shop", (query) => query.eq("shopId", shopId))
				.unique();

			return [shopId, installation ?? null] as const;
		}),
	);

	return new Map(installations);
}

async function readOrganizationsForShop(ctx: QueryCtx, shopId: Id<"shops">) {
	const organizations = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
		model: "organization",
		paginationOpts: {
			cursor: null,
			numItems: 100,
		},
		where: [
			{
				field: "shopId",
				value: shopId,
			},
		],
	})) as BetterAuthPage<BetterAuthOrganizationRecord>;

	return organizations.page;
}

async function readMembersForOrganizationIds(ctx: QueryCtx, organizationIds: string[]) {
	if (organizationIds.length === 0) {
		return [] as BetterAuthMemberRecord[];
	}

	const members = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
		model: "member",
		paginationOpts: {
			cursor: null,
			numItems: 250,
		},
		where: [
			{
				field: "organizationId",
				operator: "in",
				value: organizationIds,
			},
		],
	})) as BetterAuthPage<BetterAuthMemberRecord>;

	return members.page;
}

async function readThreadMeta(ctx: QueryCtx, threadId: string) {
	try {
		const thread = await ctx.runQuery(components.agent.threads.getThread, {
			threadId,
		});

		return {
			error: null,
			thread: thread
				? {
						status: thread.status,
						title: thread.title ?? null,
						userId: thread.userId ?? null,
					}
				: null,
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Thread metadata is unavailable.",
			thread: null,
		};
	}
}

export const listShops = query({
	args: {
		dir: SORT_DIRECTION_VALIDATOR,
		paginationOpts: paginationOptsValidator,
		q: v.optional(v.string()),
		sort: v.union(v.literal("createdAt"), v.literal("domain")),
		status: SHOP_STATUS_VALIDATOR,
	},
	handler: async (ctx, args): Promise<InternalShopsListData> => {
		await requireAdmin(ctx);

		const prefix = normalizePrefix(args.q);
		const sort = prefix ? "domain" : args.sort;
		const direction = sort === "domain" ? "asc" : args.dir;
		const shopStatus = args.status;
		const querySource =
			sort === "domain"
				? prefix
					? ctx.db
							.query("shops")
							.withIndex("by_domain", (query) =>
								query.gte("domain", prefix).lt("domain", prefixUpperBound(prefix)),
							)
					: ctx.db.query("shops").withIndex("by_domain")
				: shopStatus
					? ctx.db
							.query("shops")
							.withIndex("by_install_status_and_created_at", (query) =>
								query.eq("installStatus", shopStatus),
							)
					: ctx.db.query("shops").withIndex("by_created_at");
		const result = await querySource.order(direction).paginate(args.paginationOpts);
		const installationMap = await readInstallationMap(
			ctx,
			result.page.map((record) => record._id),
		);

		return {
			generatedAt: new Date().toISOString(),
			pageInfo: formatPageInfo(result),
			records: result.page.map((record) =>
				toShopSummary(record, installationMap.get(record._id) ?? null),
			),
		};
	},
});

export const getShopDetail = query({
	args: {
		shopId: v.id("shops"),
	},
	handler: async (ctx, args): Promise<InternalShopDetailData | null> => {
		await requireAdmin(ctx);

		const shop = await ctx.db.get(args.shopId);

		if (!shop) {
			return null;
		}

		const [
			installation,
			recentCacheStates,
			recentWorkflows,
			recentWebhookDeliveries,
			recentSessions,
		] = await Promise.all([
			ctx.db
				.query("shopifyInstallations")
				.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
				.unique(),
			ctx.db
				.query("shopifyCacheStates")
				.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(5),
			ctx.db
				.query("syncJobs")
				.withIndex("by_shop_and_last_updated_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(5),
			ctx.db
				.query("webhookDeliveries")
				.withIndex("by_shop_and_received_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(5),
			ctx.db
				.query("storefrontAiSessions")
				.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(5),
		]);
		const organizations = await readOrganizationsForShop(ctx, shop._id);
		const organizationIds = organizations.map((record) => getAuthRecordId(record)).filter(Boolean);
		const members = await readMembersForOrganizationIds(ctx, organizationIds);

		return {
			installation: installation
				? {
						accessTokenExpiresAt: formatTimestamp(installation.accessTokenExpiresAt),
						apiVersion: installation.apiVersion,
						lastTokenExchangeAt: formatTimestamp(installation.lastTokenExchangeAt),
						refreshTokenExpiresAt: formatTimestamp(installation.refreshTokenExpiresAt),
						scopeCount: installation.scopes.length,
						status: installation.status,
					}
				: null,
			memberCount: members.length,
			organizationCount: organizations.length,
			recentAiSessions: recentSessions.map((record) => toAiSessionSummary(record, shop)),
			recentCacheStates: recentCacheStates.map(toCacheStateSummary),
			recentWebhookDeliveries: recentWebhookDeliveries.map(toWebhookSummary),
			recentWorkflows: recentWorkflows.map(toWorkflowSummary),
			shop: toShopSummary(shop, installation ?? null),
		};
	},
});

export const listCacheStates = query({
	args: {
		dir: SORT_DIRECTION_VALIDATOR,
		paginationOpts: paginationOptsValidator,
		q: v.optional(v.string()),
		sort: v.union(v.literal("cacheKey"), v.literal("updatedAt")),
		status: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<InternalCacheStatesListData> => {
		await requireAdmin(ctx);

		const prefix = normalizePrefix(args.q);
		const sort = prefix ? "cacheKey" : args.sort;
		const direction = sort === "cacheKey" ? "asc" : args.dir;
		const cacheStatus = args.status;
		const querySource =
			sort === "cacheKey"
				? prefix
					? ctx.db
							.query("shopifyCacheStates")
							.withIndex("by_cache_key", (query) =>
								query.gte("cacheKey", prefix).lt("cacheKey", prefixUpperBound(prefix)),
							)
					: ctx.db.query("shopifyCacheStates").withIndex("by_cache_key")
				: cacheStatus
					? ctx.db
							.query("shopifyCacheStates")
							.withIndex("by_status_and_updated_at", (query) => query.eq("status", cacheStatus))
					: ctx.db.query("shopifyCacheStates").withIndex("by_updated_at");
		const result = await querySource.order(direction).paginate(args.paginationOpts);

		return {
			generatedAt: new Date().toISOString(),
			pageInfo: formatPageInfo(result),
			records: result.page.map(toCacheStateSummary),
		};
	},
});

export const getCacheStateDetail = query({
	args: {
		cacheStateId: v.id("shopifyCacheStates"),
	},
	handler: async (ctx, args): Promise<InternalCacheStateDetailData | null> => {
		await requireAdmin(ctx);

		const record = await ctx.db.get(args.cacheStateId);

		if (!record) {
			return null;
		}

		const [shop, recentWorkflows, recentWebhookDeliveries] = await Promise.all([
			ctx.db.get(record.shopId),
			ctx.db
				.query("syncJobs")
				.withIndex("by_shop_and_last_updated_at", (query) => query.eq("shopId", record.shopId))
				.order("desc")
				.take(5),
			ctx.db
				.query("webhookDeliveries")
				.withIndex("by_shop_and_received_at", (query) => query.eq("shopId", record.shopId))
				.order("desc")
				.take(5),
		]);

		return {
			record: {
				...toCacheStateSummary(record),
				enabled: record.enabled,
				lastError: record.lastError ?? null,
				lastFailedAt: formatTimestamp(record.lastFailedAt),
				lastReconciledAt: formatTimestamp(record.lastReconciledAt),
				lastRefreshedAt: formatTimestamp(record.lastRefreshedAt),
				lastSourceUpdatedAt: formatTimestamp(record.lastSourceUpdatedAt),
				lastStartedAt: formatTimestamp(record.lastStartedAt),
				pendingReason: record.pendingReason ?? null,
				staleAfterAt: formatTimestamp(record.staleAfterAt),
			},
			recentWebhookDeliveries: recentWebhookDeliveries.map(toWebhookSummary),
			recentWorkflows: recentWorkflows.map(toWorkflowSummary),
			shopName: shop?.name ?? "Unknown shop",
		};
	},
});

export const listWorkflows = query({
	args: {
		dir: SORT_DIRECTION_VALIDATOR,
		paginationOpts: paginationOptsValidator,
		q: v.optional(v.string()),
		sort: v.union(v.literal("lastUpdatedAt"), v.literal("type")),
		status: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<InternalWorkflowsListData> => {
		await requireAdmin(ctx);

		const prefix = normalizePrefix(args.q);
		const sort = prefix ? "type" : args.sort;
		const direction = sort === "type" ? "asc" : args.dir;
		const workflowStatus = args.status;
		const querySource =
			sort === "type"
				? prefix
					? ctx.db
							.query("syncJobs")
							.withIndex("by_type_and_last_updated_at", (query) =>
								query.gte("type", prefix).lt("type", prefixUpperBound(prefix)),
							)
					: ctx.db.query("syncJobs").withIndex("by_type_and_last_updated_at")
				: workflowStatus
					? ctx.db
							.query("syncJobs")
							.withIndex("by_status_and_last_updated_at", (query) =>
								query.eq("status", workflowStatus),
							)
					: ctx.db.query("syncJobs").withIndex("by_last_updated_at");
		const result = await querySource.order(direction).paginate(args.paginationOpts);

		return {
			generatedAt: new Date().toISOString(),
			pageInfo: formatPageInfo(result),
			records: result.page.map(toWorkflowSummary),
		};
	},
});

export const getWorkflowDetail = query({
	args: {
		jobId: v.id("syncJobs"),
	},
	handler: async (ctx, args): Promise<InternalWorkflowDetailData | null> => {
		await requireAdmin(ctx);

		const record = await ctx.db.get(args.jobId);

		if (!record) {
			return null;
		}

		const [shop, logs] = await Promise.all([
			ctx.db.get(record.shopId),
			ctx.db
				.query("workflowLogs")
				.withIndex("by_job_and_created_at", (query) => query.eq("jobId", record._id))
				.order("desc")
				.take(20),
		]);

		return {
			logs: logs
				.slice()
				.reverse()
				.map<InternalWorkflowLog>((log) => ({
					createdAt: formatTimestamp(log.createdAt) ?? new Date(0).toISOString(),
					detail: log.detail ?? null,
					level: log.level,
					message: log.message,
				})),
			record: {
				...toWorkflowSummary(record),
				resultSummary: record.resultSummary ?? null,
				retryAt: formatTimestamp(record.retryAt),
				shopName: shop?.name ?? "Unknown shop",
			},
		};
	},
});

export const listWebhookDeliveries = query({
	args: {
		dir: SORT_DIRECTION_VALIDATOR,
		paginationOpts: paginationOptsValidator,
		q: v.optional(v.string()),
		sort: v.union(v.literal("receivedAt"), v.literal("topic")),
		status: v.optional(v.string()),
	},
	handler: async (ctx, args): Promise<InternalWebhooksListData> => {
		await requireAdmin(ctx);

		const prefix = normalizePrefix(args.q);
		const sort = prefix ? "topic" : args.sort;
		const direction = sort === "topic" ? "asc" : args.dir;
		const webhookStatus = args.status;
		const querySource =
			sort === "topic"
				? prefix
					? ctx.db
							.query("webhookDeliveries")
							.withIndex("by_topic_and_received_at", (query) =>
								query.gte("topic", prefix).lt("topic", prefixUpperBound(prefix)),
							)
					: ctx.db.query("webhookDeliveries").withIndex("by_topic_and_received_at")
				: webhookStatus
					? ctx.db
							.query("webhookDeliveries")
							.withIndex("by_status_received_at", (query) => query.eq("status", webhookStatus))
					: ctx.db.query("webhookDeliveries").withIndex("by_received_at");
		const result = await querySource.order(direction).paginate(args.paginationOpts);

		return {
			generatedAt: new Date().toISOString(),
			pageInfo: formatPageInfo(result),
			records: result.page.map(toWebhookSummary),
		};
	},
});

export const getWebhookDetail = query({
	args: {
		deliveryId: v.id("webhookDeliveries"),
	},
	handler: async (ctx, args): Promise<InternalWebhookDetailData | null> => {
		await requireAdmin(ctx);

		const record = await ctx.db.get(args.deliveryId);

		if (!record) {
			return null;
		}

		const [shop, payloads] = await Promise.all([
			record.shopId ? ctx.db.get(record.shopId) : Promise.resolve(null),
			ctx.db
				.query("webhookPayloads")
				.withIndex("by_delivery", (query) => query.eq("deliveryId", record._id))
				.order("desc")
				.take(5),
		]);

		return {
			payloads: payloads.map<InternalWebhookPayloadSummary>((payload) => ({
				createdAt: formatTimestamp(payload.createdAt) ?? new Date(0).toISOString(),
				id: payload._id,
				payloadPreview: payload.payloadPreview,
			})),
			record: {
				...toWebhookSummary(record),
				apiVersion: record.apiVersion ?? null,
				eventId: record.eventId ?? null,
				shopName: shop?.name ?? null,
				triggeredAt: record.triggeredAt ?? null,
			},
		};
	},
});

export const listAudits = query({
	args: {
		dir: SORT_DIRECTION_VALIDATOR,
		paginationOpts: paginationOptsValidator,
		q: v.optional(v.string()),
		sort: v.union(v.literal("action"), v.literal("createdAt")),
	},
	handler: async (ctx, args): Promise<InternalAuditsListData> => {
		await requireAdmin(ctx);

		const prefix = normalizePrefix(args.q);
		const sort = prefix ? "action" : args.sort;
		const direction = sort === "action" ? "asc" : args.dir;
		const querySource =
			sort === "action"
				? prefix
					? ctx.db
							.query("auditLogs")
							.withIndex("by_action_and_created_at", (query) =>
								query.gte("action", prefix).lt("action", prefixUpperBound(prefix)),
							)
					: ctx.db.query("auditLogs").withIndex("by_action_and_created_at")
				: ctx.db.query("auditLogs").withIndex("by_created_at");
		const result = await querySource.order(direction).paginate(args.paginationOpts);

		return {
			generatedAt: new Date().toISOString(),
			pageInfo: formatPageInfo(result),
			records: result.page.map(toAuditSummary),
		};
	},
});

export const getAuditDetail = query({
	args: {
		auditId: v.id("auditLogs"),
	},
	handler: async (ctx, args): Promise<InternalAuditDetailData | null> => {
		await requireAdmin(ctx);

		const record = await ctx.db.get(args.auditId);

		if (!record) {
			return null;
		}

		const shop = record.shopId ? await ctx.db.get(record.shopId) : null;

		return {
			record: {
				...toAuditSummary(record),
				payloadJson: formatJson(record.payload),
				shopDomain: shop?.domain ?? null,
				shopName: shop?.name ?? null,
			},
		};
	},
});

export const listAiSessions = query({
	args: {
		dir: SORT_DIRECTION_VALIDATOR,
		paginationOpts: paginationOptsValidator,
		q: v.optional(v.string()),
		sort: v.union(v.literal("sessionId"), v.literal("updatedAt")),
	},
	handler: async (ctx, args): Promise<InternalAiSessionsListData> => {
		await requireAdmin(ctx);

		const prefix = normalizePrefix(args.q);
		const sort = prefix ? "sessionId" : args.sort;
		const direction = sort === "sessionId" ? "asc" : args.dir;
		const useThreadIndex = prefix?.startsWith("thread") ?? false;
		const querySource =
			sort === "sessionId"
				? prefix
					? useThreadIndex
						? ctx.db
								.query("storefrontAiSessions")
								.withIndex("by_thread_id", (query) =>
									query.gte("threadId", prefix).lt("threadId", prefixUpperBound(prefix)),
								)
						: ctx.db
								.query("storefrontAiSessions")
								.withIndex("by_session_id", (query) =>
									query.gte("sessionId", prefix).lt("sessionId", prefixUpperBound(prefix)),
								)
					: ctx.db.query("storefrontAiSessions").withIndex("by_session_id")
				: ctx.db.query("storefrontAiSessions").withIndex("by_updated_at");
		const result = await querySource.order(direction).paginate(args.paginationOpts);
		const shopMap = await readShopMap(
			ctx,
			result.page.map((record) => record.shopId),
		);

		return {
			generatedAt: new Date().toISOString(),
			pageInfo: formatPageInfo(result),
			records: result.page.map((record) =>
				toAiSessionSummary(record, shopMap.get(record.shopId) ?? null),
			),
		};
	},
});

export const getAiSessionDetail = query({
	args: {
		sessionDocumentId: v.id("storefrontAiSessions"),
	},
	handler: async (ctx, args): Promise<InternalAiSessionDetailData | null> => {
		await requireAdmin(ctx);

		const record = await ctx.db.get(args.sessionDocumentId);

		if (!record) {
			return null;
		}

		const [shop, threadMeta] = await Promise.all([
			ctx.db.get(record.shopId),
			readThreadMeta(ctx, record.threadId),
		]);

		return {
			session: {
				...toAiSessionSummary(record, shop),
				lastCardCount: record.lastReply?.cards.length ?? 0,
				lastCartPlanItemCount: record.lastReply?.cartPlan?.items.length ?? 0,
				lastReplyOrder: record.lastReplyOrder ?? null,
				threadError: threadMeta.error,
				threadStatus: threadMeta.thread?.status ?? "missing",
				threadTitle: threadMeta.thread?.title ?? null,
				threadUserId: threadMeta.thread?.userId ?? null,
			},
		};
	},
});

export const getAiSessionTranscriptPage = query({
	args: {
		paginationOpts: paginationOptsValidator,
		sessionDocumentId: v.id("storefrontAiSessions"),
	},
	handler: async (ctx, args): Promise<InternalAiTranscriptPageData> => {
		await requireAdmin(ctx);

		const record = await ctx.db.get(args.sessionDocumentId);

		if (!record) {
			return {
				generatedAt: new Date().toISOString(),
				messages: [],
				pageInfo: {
					continueCursor: null,
					isDone: true,
				},
			};
		}

		const result = await ctx.db
			.query("storefrontAiSessionMessages")
			.withIndex("by_shop_and_session_id_and_created_at", (query) =>
				query.eq("shopId", record.shopId).eq("sessionId", record.sessionId),
			)
			.order("desc")
			.paginate(args.paginationOpts);

		return {
			generatedAt: new Date().toISOString(),
			messages: result.page.slice().reverse().map(toSessionTranscriptMessage),
			pageInfo: formatPageInfo(result),
		};
	},
});

export const listUsers = query({
	args: {
		dir: SORT_DIRECTION_VALIDATOR,
		paginationOpts: paginationOptsValidator,
		q: v.optional(v.string()),
		role: v.optional(v.string()),
		sort: v.union(v.literal("createdAt"), v.literal("name")),
	},
	handler: async (ctx, args): Promise<InternalUsersListData> => {
		await requireAdmin(ctx);

		const prefix = normalizePrefix(args.q);
		const where =
			prefix && !args.role
				? [
						{
							field: "name",
							operator: "contains" as const,
							value: prefix,
						},
						{
							connector: "OR" as const,
							field: "email",
							operator: "contains" as const,
							value: prefix,
						},
					]
				: args.role
					? [
							{
								field: "role",
								value: args.role,
							},
						]
					: undefined;
		const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
			model: "user",
			paginationOpts: args.paginationOpts,
			sortBy: {
				direction: args.dir,
				field: args.sort,
			},
			where,
		})) as BetterAuthPage<BetterAuthUserRecord>;

		return {
			generatedAt: new Date().toISOString(),
			pageInfo: formatPageInfo(result),
			records: result.page.map(toUserSummary),
		};
	},
});

export const getUserDetail = query({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args): Promise<InternalUserDetailData | null> => {
		await requireAdmin(ctx);

		const user = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: "user",
			where: [
				{
					field: "_id",
					value: args.userId,
				},
			],
		})) as BetterAuthUserRecord | null;

		if (!user) {
			return null;
		}

		const [sessionsResult, membersResult] = await Promise.all([
			ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "session",
				paginationOpts: {
					cursor: null,
					numItems: 10,
				},
				sortBy: {
					direction: "desc",
					field: "updatedAt",
				},
				where: [
					{
						field: "userId",
						value: args.userId,
					},
				],
			}) as Promise<BetterAuthPage<BetterAuthSessionRecord>>,
			ctx.runQuery(components.betterAuth.adapter.findMany, {
				model: "member",
				paginationOpts: {
					cursor: null,
					numItems: 25,
				},
				where: [
					{
						field: "userId",
						value: args.userId,
					},
				],
			}) as Promise<BetterAuthPage<BetterAuthMemberRecord>>,
		]);
		const organizations = await Promise.all(
			membersResult.page.map(
				(member) =>
					ctx.runQuery(components.betterAuth.adapter.findOne, {
						model: "organization",
						where: [
							{
								field: "_id",
								value: member.organizationId,
							},
						],
					}) as Promise<BetterAuthOrganizationRecord | null>,
			),
		);
		const memberships = membersResult.page.map<InternalUserMembershipSummary>((member, index) => ({
			memberId: getAuthRecordId(member),
			organizationId: member.organizationId,
			role: member.role ?? null,
			shopDomain: organizations[index]?.shopDomain ?? null,
			shopId: organizations[index]?.shopId ?? null,
		}));
		const recentSessions = sessionsResult.page.map<InternalUserSessionSummary>((session) => ({
			activeOrganizationId: session.activeOrganizationId ?? null,
			createdAt: formatTimestamp(session.createdAt ?? null),
			expiresAt: formatTimestamp(session.expiresAt ?? null),
			id: getAuthRecordId(session),
			updatedAt: formatTimestamp(session.updatedAt ?? null),
		}));

		return {
			user: {
				...toUserSummary(user),
				activeOrganizationId: recentSessions[0]?.activeOrganizationId ?? null,
				memberships,
				recentSessions,
				sessionCount: sessionsResult.page.length,
			},
		};
	},
});
