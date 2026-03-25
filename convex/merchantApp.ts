import { v } from "convex/values";
import type { MetricCard, SignalLine, TableRecord } from "../src/shared/contracts/app-shell";
import type {
	MerchantAssistantReply,
	MerchantSettingsData,
	ThemeAppEmbedStatus,
} from "../src/shared/contracts/merchant-settings";
import {
	DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
	DEFAULT_STOREFRONT_WIDGET_GREETING,
	DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
	DEFAULT_STOREFRONT_WIDGET_POSITION,
	type WidgetPosition,
} from "../src/shared/contracts/storefront-widget";
import type { SystemStatusSnapshot } from "../src/shared/contracts/system-status";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, internalQuery, mutation, query, type ActionCtx } from "./_generated/server";
import { requireMerchantActor, requireMerchantClaims } from "./merchantAuth";
import {
	fetchThemeAppEmbedDiagnostics,
	getRequiredShopifyEnv,
	SHOPIFY_API_VERSION,
} from "./shopifyAdmin";

type WidgetConfigRecord = Doc<"widgetConfigs"> & {
	knowledgeSources?: string[];
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

export const getSettingsState = internalQuery({
	args: {
		merchantActorId: v.id("merchantActors"),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		shopifyUserId: v.string(),
	},
	handler: async (ctx, args) => {
		const actor = await ctx.db.get(args.merchantActorId);

		if (!actor || actor.shopId !== args.shopId || actor.shopifyUserId !== args.shopifyUserId) {
			throw new Error("Authenticated merchant actor could not be resolved for settings.");
		}

		const shop = await ctx.db.get(args.shopId);

		if (!shop || shop.domain !== args.shopDomain) {
			throw new Error("Authenticated shop could not be resolved for settings.");
		}

		const [installation, widgetConfig, recentWebhookDeliveries] = await Promise.all([
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
		]);

		return {
			actor,
			installation,
			recentWebhookDeliveries,
			shop,
			widgetConfig,
		};
	},
});

async function loadMerchantSettingsData(ctx: ActionCtx): Promise<MerchantSettingsData> {
	const claims = await requireMerchantClaims(ctx);
	const state = await ctx.runQuery(internal.merchantApp.getSettingsState, claims);
	const widgetSettings = getWidgetSettingsRecord(state.widgetConfig as WidgetConfigRecord | null);
	const recentTopics = Array.from(
		new Set(state.recentWebhookDeliveries.map((delivery) => delivery.topic)),
	).slice(0, 5);
	let extensionStatus: MerchantSettingsData["extensionStatus"] = {
		activationUrl: null,
		errorMessage: null,
		mainThemeId: null,
		mainThemeName: null,
		status: "unavailable",
	};

	if (state.installation?.accessToken) {
		try {
			const diagnostics = await fetchThemeAppEmbedDiagnostics({
				accessToken: state.installation.accessToken,
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
		position: v.union(v.literal("bottom-right"), v.literal("bottom-left")),
	},
	handler: async (ctx, args) => {
		const { actor, shop } = await requireMerchantActor(ctx);
		const greeting = args.greeting.trim();
		const accentColor = args.accentColor.trim();
		const knowledgeSources = normalizeKnowledgeSources(args.knowledgeSources);

		if (greeting.length < 8) {
			throw new Error("Greeting must be at least 8 characters.");
		}

		if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
			throw new Error("Accent color must be a 6-digit hex color such as #0f172a.");
		}

		if (knowledgeSources.some((source) => source.length > 160)) {
			throw new Error("Each public knowledge source must be 160 characters or fewer.");
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
