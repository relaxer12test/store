import { v } from "convex/values";
import type { MetricCard, SignalLine, TableRecord, Tone } from "../src/shared/contracts/app-shell";
import type {
	MerchantAssistantReply,
	MerchantSettingsData,
	ThemeAppEmbedStatus,
} from "../src/shared/contracts/merchant-settings";
import {
	DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
	DEFAULT_STOREFRONT_WIDGET_GREETING,
	DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
	DEFAULT_STOREFRONT_WIDGET_POLICY_ANSWERS,
	DEFAULT_STOREFRONT_WIDGET_POSITION,
	type StorefrontPolicyAnswers,
	type WidgetPosition,
} from "../src/shared/contracts/storefront-widget";
import type { SystemStatusSnapshot } from "../src/shared/contracts/system-status";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalQuery, mutation, query, type ActionCtx } from "./_generated/server";
import { requireMerchantActor, requireMerchantClaims } from "./merchantAuth";
import { hasConnectedShopifyAccess } from "./shopifyAccess";
import {
	fetchThemeAppEmbedDiagnostics,
	getRequiredShopifyEnv,
	SHOPIFY_API_VERSION,
} from "./shopifyAdmin";

type WidgetConfigRecord = Doc<"widgetConfigs"> & {
	knowledgeSources?: string[];
	policyAnswers?: StorefrontPolicyAnswers;
};

function formatTimestamp(value: number | null | undefined) {
	if (!value) {
		return "n/a";
	}

	return new Date(value).toISOString();
}

function formatNullableTimestamp(value: number | null | undefined) {
	return value ? new Date(value).toISOString() : null;
}

function normalizeKnowledgeSources(knowledgeSources: string[]) {
	return knowledgeSources
		.map((source) => source.trim())
		.filter(Boolean)
		.slice(0, 8);
}

function getWidgetSettingsRecord(widgetConfig: WidgetConfigRecord | null) {
	return {
		accentColor: widgetConfig?.accentColor ?? DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
		enabled: widgetConfig?.enabled ?? true,
		greeting: widgetConfig?.greeting ?? DEFAULT_STOREFRONT_WIDGET_GREETING,
		knowledgeSources: widgetConfig?.knowledgeSources ?? DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
		policyAnswers: widgetConfig?.policyAnswers ?? DEFAULT_STOREFRONT_WIDGET_POLICY_ANSWERS,
		position: (widgetConfig?.position ?? DEFAULT_STOREFRONT_WIDGET_POSITION) as WidgetPosition,
	};
}

function getThemeStatusDetail(status: ThemeAppEmbedStatus) {
	switch (status) {
		case "enabled":
			return "The storefront app embed is enabled on the live theme.";
		case "disabled":
			return "The storefront app embed exists on the live theme, but it is currently disabled.";
		case "not_detected":
			return "The storefront app embed has not been activated on the live theme yet.";
		case "unavailable":
			return "Theme diagnostics are unavailable until a valid offline Admin API token is present.";
	}
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

function cacheTone(status: string | undefined): Tone {
	switch (status) {
		case "ready":
			return "success";
		case "pending":
		case "running":
			return "accent";
		case "error":
			return "blocked";
		case "disabled":
			return "neutral";
		default:
			return "watch";
	}
}

function getCacheStaleWarning(cacheState: Doc<"shopifyCacheStates">, now: number) {
	if (cacheState.status === "error") {
		return cacheState.lastError ?? "The cache entered an error state.";
	}

	if (
		cacheState.lastWebhookAt &&
		(!cacheState.lastCompletedAt || cacheState.lastWebhookAt > cacheState.lastCompletedAt)
	) {
		return "A newer webhook landed after the last successful refresh.";
	}

	if (cacheState.staleAfterAt && cacheState.staleAfterAt <= now) {
		return "The refresh window has elapsed and the cache should be reconciled.";
	}

	return null;
}

function buildMetrics({
	auditLogCount,
	catalogCacheState,
	installation,
	metricsCache,
	metricsCacheState,
	shop,
	syncJobCount,
	webhookDeliveryCount,
}: {
	auditLogCount: number;
	catalogCacheState: Doc<"shopifyCacheStates"> | null;
	installation: Doc<"shopifyInstallations"> | null;
	metricsCache: Doc<"shopifyMetricsCaches"> | null;
	metricsCacheState: Doc<"shopifyCacheStates"> | null;
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
			label: "Catalog index",
			value: String(catalogCacheState?.recordCount ?? 0),
			delta: catalogCacheState?.status ?? "missing",
			hint: "Sanitized public products back storefront search and retrieval when the cache is enabled.",
			tone: cacheTone(catalogCacheState?.status),
		},
		{
			label: "Metrics cache",
			value: String(metricsCache?.productCount ?? 0),
			delta: metricsCacheState?.status ?? "missing",
			hint: "Dashboard cards can reuse cached Shopify counts instead of refetching on every load.",
			tone: cacheTone(metricsCacheState?.status),
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
	cacheStates,
	installation,
	shop,
	syncJobCount,
	webhookDeliveryCount,
	widgetConfigExists,
}: {
	auditLogCount: number;
	cacheStates: Doc<"shopifyCacheStates">[];
	installation: Doc<"shopifyInstallations"> | null;
	shop: Doc<"shops">;
	syncJobCount: number;
	webhookDeliveryCount: number;
	widgetConfigExists: boolean;
}): SignalLine[] {
	const staleWarnings = cacheStates
		.map((cacheState) => getCacheStaleWarning(cacheState, Date.now()))
		.filter((warning): warning is string => warning !== null);

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
			label: "Cache freshness",
			detail:
				cacheStates.length === 0
					? "No Shopify cache state exists for this shop yet."
					: staleWarnings.length > 0
						? `${staleWarnings.length} cache warning(s) currently need attention.`
						: "Catalog and metrics caches are fresh enough for the current merchant surfaces.",
			tone: cacheStates.length === 0 ? "watch" : staleWarnings.length > 0 ? "watch" : "success",
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
	cacheStates,
	installation,
	shop,
	syncJobCount,
	webhookDeliveryCount,
	widgetConfigExists,
}: {
	auditLogCount: number;
	cacheStates: Doc<"shopifyCacheStates">[];
	installation: Doc<"shopifyInstallations"> | null;
	shop: Doc<"shops">;
	syncJobCount: number;
	webhookDeliveryCount: number;
	widgetConfigExists: boolean;
}) {
	const cacheErrors = cacheStates
		.map((cacheState) =>
			cacheState.status === "error"
				? `${cacheState.cacheKey} is in error: ${cacheState.lastError ?? "Unknown error."}`
				: null,
		)
		.filter((value): value is string => value !== null);

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
		...cacheErrors,
	].filter((value): value is string => value !== null);
}

function buildMerchantAssistantResponse({
	extensionStatus,
	prompt,
	settings,
}: {
	extensionStatus: MerchantSettingsData["extensionStatus"];
	prompt: string;
	settings: MerchantSettingsData;
}): MerchantAssistantReply {
	const normalizedPrompt = prompt.toLowerCase();

	if (
		normalizedPrompt.includes("theme") ||
		normalizedPrompt.includes("embed") ||
		normalizedPrompt.includes("storefront")
	) {
		return {
			answer: `${getThemeStatusDetail(extensionStatus.status)} ${
				extensionStatus.mainThemeName
					? `The live theme is ${extensionStatus.mainThemeName}.`
					: "The live theme name is not available yet."
			}`,
			nextActions: [
				extensionStatus.activationUrl
					? "Open the theme editor deep link to activate or review the app embed."
					: "Refresh the settings page after bootstrap to regenerate the theme-editor link.",
				"Save the theme after enabling the app embed.",
				"Use merchant settings for greeting, accent color, position, and knowledge-source updates.",
			],
		};
	}

	if (
		normalizedPrompt.includes("webhook") ||
		normalizedPrompt.includes("delivery") ||
		normalizedPrompt.includes("sync")
	) {
		return {
			answer: `The app has recorded ${settings.webhookHealth.recentDeliveryCount} recent webhook deliveries. ${
				settings.webhookHealth.lastDeliveryAt
					? `The most recent delivery landed at ${settings.webhookHealth.lastDeliveryAt}.`
					: "No delivery timestamp is available yet."
			}`,
			nextActions: [
				"Open the internal webhook diagnostics route for per-topic delivery details.",
				"Trigger a product or inventory change on the dev store to validate end-to-end ingestion.",
				"Confirm shopify.app.toml topics stay aligned with the ingestion logic.",
			],
		};
	}

	if (
		normalizedPrompt.includes("install") ||
		normalizedPrompt.includes("scope") ||
		normalizedPrompt.includes("token")
	) {
		return {
			answer: `${settings.installHealth.shopName} is ${settings.installHealth.installStatus} with token status ${settings.installHealth.tokenStatus}. The Admin API version is ${settings.installHealth.apiVersion ?? SHOPIFY_API_VERSION}.`,
			nextActions: [
				"Reopen the embedded app from Shopify admin if the offline token needs a fresh exchange.",
				"Compare current scopes with shopify.app.toml before adding new Shopify features.",
				"Use settings to confirm storefront activation after scope changes or reinstall.",
			],
		};
	}

	if (
		normalizedPrompt.includes("cache") ||
		normalizedPrompt.includes("catalog") ||
		normalizedPrompt.includes("stale")
	) {
		return {
			answer: `The merchant surfaces currently have ${settings.cacheHealth.caches.length} cache state row(s). ${
				settings.cacheHealth.lastSuccessfulRefreshAt
					? `The most recent successful refresh finished at ${settings.cacheHealth.lastSuccessfulRefreshAt}.`
					: "No successful cache refresh has been recorded yet."
			}`,
			nextActions: [
				"Open workflows to inspect the current sync job queue and recent completions.",
				"Use settings to review stale-cache warnings and the most recent webhook timestamp.",
				"Trigger a product, inventory, or order change if you need to exercise a specific cache path.",
			],
		};
	}

	return {
		answer: `${settings.installHealth.shopName} is connected, the storefront widget is ${
			settings.widgetSettings.enabled ? "enabled" : "disabled"
		} in app settings, and the theme embed status is ${extensionStatus.status}.`,
		nextActions: [
			"Ask about install health, webhook posture, or storefront embed activation for a more specific answer.",
			"Use merchant settings to adjust greeting, accent color, position, and public knowledge sources.",
			"Open the theme editor deep link when you need to activate or inspect the app embed on the live theme.",
		],
	};
}

interface MerchantSettingsState {
	actor: Doc<"merchantActors">;
	cacheStates: Doc<"shopifyCacheStates">[];
	installation: Doc<"shopifyInstallations"> | null;
	pendingJobs: Doc<"syncJobs">[];
	recentWebhookDeliveries: Doc<"webhookDeliveries">[];
	shop: Doc<"shops">;
	widgetConfig: Doc<"widgetConfigs"> | null;
}

export const getSettingsState = internalQuery({
	args: {
		merchantActorId: v.id("merchantActors"),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		shopifyUserId: v.string(),
	},
	handler: async (ctx, args): Promise<MerchantSettingsState> => {
		const actor = await ctx.db.get(args.merchantActorId);

		if (!actor || actor.shopId !== args.shopId || actor.shopifyUserId !== args.shopifyUserId) {
			throw new Error("Authenticated merchant actor could not be resolved for settings.");
		}

		const shop = await ctx.db.get(args.shopId);

		if (!shop || shop.domain !== args.shopDomain) {
			throw new Error("Authenticated shop could not be resolved for settings.");
		}

		const [
			installation,
			widgetConfig,
			recentWebhookDeliveries,
			cacheStates,
			pendingJobs,
			runningJobs,
		] = await Promise.all([
			ctx.db
				.query("shopifyInstallations")
				.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
				.unique(),
			ctx.db
				.query("widgetConfigs")
				.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
				.unique(),
			ctx.db
				.query("webhookDeliveries")
				.withIndex("by_shop_and_received_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(20),
			ctx.db
				.query("shopifyCacheStates")
				.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(10),
			ctx.db
				.query("syncJobs")
				.withIndex("by_shop_status", (query) =>
					query.eq("shopId", shop._id).eq("status", "pending"),
				)
				.take(20),
			ctx.db
				.query("syncJobs")
				.withIndex("by_shop_status", (query) =>
					query.eq("shopId", shop._id).eq("status", "running"),
				)
				.take(20),
		]);

		return {
			actor,
			cacheStates,
			installation,
			pendingJobs: [...pendingJobs, ...runningJobs],
			recentWebhookDeliveries,
			shop,
			widgetConfig,
		};
	},
});

async function loadMerchantSettingsData(ctx: ActionCtx): Promise<MerchantSettingsData> {
	const claims = await requireMerchantClaims(ctx);
	const state: MerchantSettingsState = await ctx.runQuery(
		internal.merchantApp.getSettingsState,
		claims,
	);
	const widgetSettings = getWidgetSettingsRecord(state.widgetConfig as WidgetConfigRecord | null);
	const recentTopics = Array.from(
		new Set(state.recentWebhookDeliveries.map((delivery) => delivery.topic)),
	).slice(0, 5);
	const cacheStatuses = state.cacheStates.map((cacheState) => ({
		cacheKey: cacheState.cacheKey,
		lastCompletedAt: formatNullableTimestamp(cacheState.lastCompletedAt),
		lastError: cacheState.lastError ?? null,
		lastRequestedAt: formatNullableTimestamp(cacheState.lastRequestedAt),
		lastWebhookAt: formatNullableTimestamp(cacheState.lastWebhookAt),
		pendingReason: cacheState.pendingReason ?? null,
		recordCount: cacheState.recordCount ?? null,
		status: cacheState.status,
		staleWarning: getCacheStaleWarning(cacheState, Date.now()),
	}));
	const successfulRefreshes = state.cacheStates
		.map((cacheState) => cacheState.lastCompletedAt)
		.filter((value): value is number => value !== undefined);
	let extensionStatus: MerchantSettingsData["extensionStatus"] = {
		activationUrl: null,
		errorMessage: null,
		mainThemeId: null,
		mainThemeName: null,
		status: "unavailable",
	};
	const installationAccessToken = state.installation?.accessToken;

	if (
		hasConnectedShopifyAccess({ installation: state.installation, shop: state.shop }) &&
		installationAccessToken
	) {
		try {
			const diagnostics = await fetchThemeAppEmbedDiagnostics({
				accessToken: installationAccessToken,
				shopDomain: state.shop.domain,
			});

			extensionStatus = {
				activationUrl: diagnostics.activationUrl,
				errorMessage: null,
				mainThemeId: diagnostics.mainThemeId,
				mainThemeName: diagnostics.mainThemeName,
				status: diagnostics.status,
			};
		} catch (error) {
			extensionStatus = {
				activationUrl: null,
				errorMessage:
					error instanceof Error ? error.message : "Theme diagnostics could not be loaded.",
				mainThemeId: null,
				mainThemeName: null,
				status: "unavailable",
			};
		}
	}

	return {
		cacheHealth: {
			caches: cacheStatuses,
			lastSuccessfulRefreshAt: formatNullableTimestamp(
				successfulRefreshes.length > 0 ? Math.max(...successfulRefreshes) : null,
			),
			pendingJobCount: state.pendingJobs.length,
			staleWarnings: cacheStatuses
				.map((cacheStatus) => cacheStatus.staleWarning)
				.filter((warning): warning is string => warning !== null),
		},
		extensionStatus,
		installHealth: {
			apiVersion: state.installation?.apiVersion ?? null,
			appUrl: getRequiredShopifyEnv("SHOPIFY_APP_URL"),
			installStatus: state.shop.installStatus,
			lastAuthenticatedAt: formatNullableTimestamp(state.shop.lastAuthenticatedAt),
			lastTokenExchangeAt: formatNullableTimestamp(state.installation?.lastTokenExchangeAt),
			scopes: state.installation?.scopes ?? [],
			shopDomain: state.shop.domain,
			shopName: state.shop.name,
			tokenStatus: state.installation?.status ?? "missing",
		},
		webhookHealth: {
			failedDeliveryCount: state.recentWebhookDeliveries.filter(
				(delivery) => delivery.status !== "processed",
			).length,
			lastDeliveryAt: formatNullableTimestamp(state.recentWebhookDeliveries[0]?.receivedAt),
			recentDeliveryCount: state.recentWebhookDeliveries.length,
			recentTopics,
		},
		widgetSettings,
	};
}

export const settings = action({
	args: {},
	handler: loadMerchantSettingsData,
});

export const updateWidgetSettings = mutation({
	args: {
		accentColor: v.string(),
		enabled: v.boolean(),
		greeting: v.string(),
		knowledgeSources: v.array(v.string()),
		policyAnswers: v.object({
			contact: v.string(),
			returns: v.string(),
			shipping: v.string(),
		}),
		position: v.union(v.literal("bottom-right"), v.literal("bottom-left")),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const greeting = args.greeting.trim();
		const accentColor = args.accentColor.trim();
		const knowledgeSources = normalizeKnowledgeSources(args.knowledgeSources);
		const policyAnswers = {
			contact: args.policyAnswers.contact.trim(),
			returns: args.policyAnswers.returns.trim(),
			shipping: args.policyAnswers.shipping.trim(),
		};

		if (greeting.length < 8) {
			throw new Error("Greeting must be at least 8 characters.");
		}

		if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
			throw new Error("Accent color must be a 6-digit hex color such as #0f172a.");
		}

		if (knowledgeSources.some((source) => source.length > 160)) {
			throw new Error("Each public knowledge source must be 160 characters or fewer.");
		}

		for (const [key, value] of Object.entries(policyAnswers)) {
			if (value.length < 12) {
				throw new Error(`${key} policy answer must be at least 12 characters.`);
			}

			if (value.length > 320) {
				throw new Error(`${key} policy answer must be 320 characters or fewer.`);
			}
		}

		const existingWidgetConfig = await ctx.db
			.query("widgetConfigs")
			.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
			.unique();
		const now = Date.now();

		if (existingWidgetConfig) {
			await ctx.db.patch(existingWidgetConfig._id, {
				accentColor,
				enabled: args.enabled,
				greeting,
				knowledgeSources,
				policyAnswers,
				position: args.position,
				updatedAt: now,
			});
		} else {
			await ctx.db.insert("widgetConfigs", {
				accentColor,
				createdAt: now,
				enabled: args.enabled,
				greeting,
				knowledgeSources,
				policyAnswers,
				position: args.position,
				shopId: shop._id,
				updatedAt: now,
			});
		}

		await ctx.db.insert("auditLogs", {
			action: "merchant.widget_settings.updated",
			actorId: actor._id,
			createdAt: now,
			detail: "Merchant storefront widget settings were updated.",
			payload: {
				accentColor,
				enabled: args.enabled,
				knowledgeSourceCount: knowledgeSources.length,
				policyTopicsConfigured: Object.keys(policyAnswers).length,
				position: args.position,
			},
			shopId: shop._id,
			status: "success",
		});

		return {
			ok: true,
			updatedAt: now,
		};
	},
});

export const assistant = action({
	args: {
		prompt: v.string(),
	},
	handler: async (ctx, args): Promise<MerchantAssistantReply> => {
		const prompt = args.prompt.trim();

		if (prompt.length === 0) {
			return {
				answer: "Ask about install health, webhook posture, or storefront embed activation.",
				nextActions: [],
			};
		}

		const settingsData = await loadMerchantSettingsData(ctx);

		return buildMerchantAssistantResponse({
			extensionStatus: settingsData.extensionStatus,
			prompt,
			settings: settingsData,
		});
	},
});

export const snapshot = query({
	args: {},
	handler: async (ctx): Promise<SystemStatusSnapshot> => {
		const { shop } = await requireMerchantActor(ctx);
		const [
			installation,
			widgetConfig,
			cacheStates,
			metricsCache,
			syncJobs,
			webhookDeliveries,
			auditLogs,
		] = await Promise.all([
			ctx.db
				.query("shopifyInstallations")
				.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
				.unique(),
			ctx.db
				.query("widgetConfigs")
				.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
				.unique(),
			ctx.db
				.query("shopifyCacheStates")
				.withIndex("by_shop_and_updated_at", (query) => query.eq("shopId", shop._id))
				.order("desc")
				.take(20),
			ctx.db
				.query("shopifyMetricsCaches")
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
		const catalogCacheState =
			cacheStates.find((cacheState) => cacheState.cacheKey === "public_catalog_index") ?? null;
		const metricsCacheState =
			cacheStates.find((cacheState) => cacheState.cacheKey === "merchant_metrics_cache") ?? null;

		return {
			metrics: buildMetrics({
				auditLogCount: auditLogs.length,
				catalogCacheState,
				installation,
				metricsCache,
				metricsCacheState,
				shop,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
			}),
			signals: buildSignals({
				auditLogCount: auditLogs.length,
				cacheStates,
				installation,
				shop,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
				widgetConfigExists: Boolean(widgetConfig),
			}),
			blockers: buildBlockers({
				auditLogCount: auditLogs.length,
				cacheStates,
				installation,
				shop,
				syncJobCount: syncJobs.length,
				webhookDeliveryCount: webhookDeliveries.length,
				widgetConfigExists: Boolean(widgetConfig),
			}),
			shops: [toShopRecord(shop, installation)],
			cacheStates: cacheStates.map(toCacheStateRecord),
			syncJobs: syncJobs.map(toSyncJobRecord),
			webhookDeliveries: webhookDeliveries.map(toWebhookDeliveryRecord),
			auditLogs: auditLogs.map(toAuditLogRecord),
		};
	},
});
