import { RequestedTokenType, type Session } from "@shopify/shopify-api";
import { v } from "convex/values";
import type { SessionEnvelope, ShopSummary, ViewerSummary } from "../src/shared/contracts/session";
import {
	DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
	DEFAULT_STOREFRONT_WIDGET_GREETING,
	DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
	DEFAULT_STOREFRONT_WIDGET_POSITION,
} from "../src/shared/contracts/storefront-widget";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { issueMerchantSessionToken } from "./merchantSessionToken";
import {
	createShopifyClient,
	SHOPIFY_API_VERSION,
	shopifyAdminGraphqlRequest,
} from "./shopifyAdmin";

const ACCESS_TOKEN_REFRESH_BUFFER_MS = 1000 * 60 * 5;
const WEBHOOK_PAYLOAD_PREVIEW_LIMIT = 16_000;

const BOOTSTRAP_QUERY = `
	query BootstrapShop {
		shop {
			id
			name
			myshopifyDomain
			plan {
				publicDisplayName
			}
		}
		currentAppInstallation {
			accessScopes {
				handle
			}
		}
	}
`;

function getInitials(name: string) {
	const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

	if (words.length === 0) {
		return "SA";
	}

	return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

function normalizeWebhookHeaderValue(value: string | undefined) {
	const trimmed = value?.trim();

	return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function buildWebhookDeliveryKey({
	domain,
	eventId,
	rawBody,
	topic,
	triggeredAt,
	webhookId,
}: {
	domain?: string;
	eventId?: string;
	rawBody: string;
	topic?: string;
	triggeredAt?: string;
	webhookId?: string;
}) {
	const identity =
		normalizeWebhookHeaderValue(webhookId) ??
		normalizeWebhookHeaderValue(eventId) ??
		`${normalizeWebhookHeaderValue(triggeredAt) ?? "unknown"}:${rawBody.replace(/\s+/g, " ").slice(0, 128)}`;

	return `${normalizeWebhookHeaderValue(domain) ?? "unknown"}::${normalizeWebhookHeaderValue(topic) ?? "unknown"}::${identity}`;
}

function getActorName(options: {
	email?: string | null;
	fallbackUserId: string;
	firstName?: string | null;
	lastName?: string | null;
}) {
	const fullName = [options.firstName, options.lastName].filter(Boolean).join(" ").trim();

	if (fullName) {
		return fullName;
	}

	if (options.email) {
		return options.email;
	}

	return `Shopify user ${options.fallbackUserId}`;
}

function toShopSummary(shop: Doc<"shops">): ShopSummary {
	return {
		id: shop._id,
		name: shop.name,
		domain: shop.domain,
		installStatus: shop.installStatus,
	};
}

function toViewerSummary(actor: Doc<"merchantActors">): ViewerSummary {
	return {
		id: actor._id,
		name: actor.name,
		email: actor.email ?? "",
		initials: actor.initials,
		roles: ["shop_admin"],
	};
}

async function createSessionEnvelope({
	actor,
	roles,
	shop,
}: {
	actor: Doc<"merchantActors">;
	roles: SessionEnvelope["roles"];
	shop: Doc<"shops">;
}): Promise<SessionEnvelope> {
	const merchantToken = await issueMerchantSessionToken({
		email: actor.email,
		merchantActorId: actor._id,
		name: actor.name,
		roles,
		shopDomain: shop.domain,
		shopId: shop._id,
		shopifyUserId: actor.shopifyUserId,
	});

	return {
		authMode: "embedded",
		state: "ready",
		viewer: toViewerSummary(actor),
		activeShop: toShopSummary(shop),
		roles,
		convexToken: merchantToken.token,
		convexTokenExpiresAt: merchantToken.expiresAt,
	};
}

function shouldRefreshInstallation(installation: {
	accessTokenExpiresAt?: number;
	refreshToken?: string;
	refreshTokenExpiresAt?: number;
}) {
	if (!installation.accessTokenExpiresAt) {
		return false;
	}

	if (!installation.refreshToken) {
		return false;
	}

	if (
		installation.refreshTokenExpiresAt &&
		installation.refreshTokenExpiresAt <= Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS
	) {
		return false;
	}

	return installation.accessTokenExpiresAt <= Date.now() + ACCESS_TOKEN_REFRESH_BUFFER_MS;
}

function sessionToInstallation(session: Session) {
	return {
		accessToken: session.accessToken ?? undefined,
		accessTokenExpiresAt: session.expires?.getTime() ?? undefined,
		refreshToken: session.refreshToken ?? undefined,
		refreshTokenExpiresAt: session.refreshTokenExpires?.getTime() ?? undefined,
		scopes:
			session.scope
				?.split(",")
				.map((scope) => scope.trim())
				.filter(Boolean) ?? [],
	};
}

async function fetchBootstrapMetadata(shop: string, accessToken: string) {
	const payload = await shopifyAdminGraphqlRequest<{
		currentAppInstallation?: {
			accessScopes?: Array<{
				handle?: string | null;
			}>;
		} | null;
		shop?: {
			id?: string | null;
			myshopifyDomain?: string | null;
			name?: string | null;
			plan?: {
				publicDisplayName?: string | null;
			} | null;
		} | null;
	}>({
		accessToken,
		query: BOOTSTRAP_QUERY,
		shop,
	});

	const shopData = payload.shop;

	if (!shopData?.name || !shopData.myshopifyDomain || !shopData.id) {
		throw new Error("Shopify bootstrap query returned incomplete shop data.");
	}

	return {
		domain: shopData.myshopifyDomain,
		name: shopData.name,
		planDisplayName: shopData.plan?.publicDisplayName ?? null,
		scopes:
			payload.currentAppInstallation?.accessScopes
				?.map((scope) => scope.handle)
				.filter((scope): scope is string => Boolean(scope)) ?? [],
		shopifyShopId: shopData.id,
	};
}

async function getOnlineUserSession(sessionToken: string) {
	const shopify = createShopifyClient();
	const decoded = await shopify.session.decodeSessionToken(sessionToken);
	const shop = new URL(decoded.dest).hostname;
	const onlineToken = await shopify.auth.tokenExchange({
		shop,
		sessionToken,
		requestedTokenType: RequestedTokenType.OnlineAccessToken,
	});

	return {
		decoded,
		onlineSession: onlineToken.session,
		shop,
	};
}

export const bootstrapSession = action({
	args: {
		sessionToken: v.string(),
	},
	handler: async (ctx, args): Promise<SessionEnvelope> => {
		const shopify = createShopifyClient();
		const { decoded, onlineSession, shop } = await getOnlineUserSession(args.sessionToken);
		const existingInstallation = await ctx.runQuery(internal.shopify.getInstallationByDomain, {
			domain: shop,
		});

		let offlineSession = existingInstallation;

		try {
			if (!existingInstallation || !existingInstallation.accessToken) {
				offlineSession = sessionToInstallation(
					(
						await shopify.auth.tokenExchange({
							shop,
							sessionToken: args.sessionToken,
							requestedTokenType: RequestedTokenType.OfflineAccessToken,
							expiring: true,
						})
					).session,
				);
			} else if (
				shouldRefreshInstallation(existingInstallation) &&
				existingInstallation.refreshToken
			) {
				offlineSession = sessionToInstallation(
					(
						await shopify.auth.refreshToken({
							shop,
							refreshToken: existingInstallation.refreshToken,
						})
					).session,
				);
			}
		} catch (error) {
			if (!existingInstallation?.accessToken) {
				throw error;
			}

			offlineSession = existingInstallation;
		}

		if (!offlineSession?.accessToken) {
			throw new Error("Shopify bootstrap could not acquire an offline Admin API token.");
		}

		const metadata = await fetchBootstrapMetadata(shop, offlineSession.accessToken);
		const associatedUser = onlineSession.onlineAccessInfo?.associated_user;
		const actorName = getActorName({
			email: associatedUser?.email,
			fallbackUserId: String(decoded.sub ?? "unknown"),
			firstName: associatedUser?.first_name,
			lastName: associatedUser?.last_name,
		});

		return await ctx.runMutation(internal.shopify.persistBootstrap, {
			accessToken: offlineSession.accessToken,
			accessTokenExpiresAt: offlineSession.accessTokenExpiresAt ?? undefined,
			actorEmail: associatedUser?.email ?? undefined,
			actorInitials: getInitials(actorName),
			actorName,
			installScopes: metadata.scopes.length > 0 ? metadata.scopes : offlineSession.scopes,
			lastAuthenticatedAt: Date.now(),
			planDisplayName: metadata.planDisplayName ?? undefined,
			refreshToken: offlineSession.refreshToken ?? undefined,
			refreshTokenExpiresAt: offlineSession.refreshTokenExpiresAt ?? undefined,
			sessionId: decoded.sid ?? undefined,
			shopDomain: metadata.domain,
			shopName: metadata.name,
			shopifyShopId: metadata.shopifyShopId,
			shopifyUserId: String(decoded.sub ?? "unknown"),
		});
	},
});

export const processWebhook = action({
	args: {
		headers: v.object({
			apiVersion: v.optional(v.string()),
			domain: v.optional(v.string()),
			eventId: v.optional(v.string()),
			hmac: v.optional(v.string()),
			name: v.optional(v.string()),
			subTopic: v.optional(v.string()),
			topic: v.optional(v.string()),
			triggeredAt: v.optional(v.string()),
			webhookId: v.optional(v.string()),
		}),
		rawBody: v.string(),
	},
	handler: async (ctx, args) => {
		const shopify = createShopifyClient();
		const payloadPreview = args.rawBody.slice(0, WEBHOOK_PAYLOAD_PREVIEW_LIMIT);
		const attemptedDeliveryKey = buildWebhookDeliveryKey({
			domain: args.headers.domain,
			eventId: args.headers.eventId,
			rawBody: args.rawBody,
			topic: args.headers.topic,
			triggeredAt: args.headers.triggeredAt,
			webhookId: args.headers.webhookId,
		});
		const request = new Request("https://storeai.ldev.cloud/api/shopify/webhooks", {
			method: "POST",
			headers: new Headers(
				Object.entries({
					"X-Shopify-API-Version": args.headers.apiVersion,
					"X-Shopify-Event-Id": args.headers.eventId,
					"X-Shopify-Hmac-Sha256": args.headers.hmac,
					"X-Shopify-Name": args.headers.name,
					"X-Shopify-Shop-Domain": args.headers.domain,
					"X-Shopify-Sub-Topic": args.headers.subTopic,
					"X-Shopify-Topic": args.headers.topic,
					"X-Shopify-Triggered-At": args.headers.triggeredAt,
					"X-Shopify-Webhook-Id": args.headers.webhookId,
				}).filter((entry): entry is [string, string] => Boolean(entry[1])),
			),
			body: args.rawBody,
		});

		const validation = await shopify.webhooks.validate({
			rawBody: args.rawBody,
			rawRequest: request,
		});

		if (!validation.valid) {
			await ctx.runMutation(internal.shopify.recordWebhookFailure, {
				apiVersion: args.headers.apiVersion,
				deliveryKey: attemptedDeliveryKey,
				domain: normalizeWebhookHeaderValue(args.headers.domain) ?? "unknown",
				error: validation.reason ?? "Shopify webhook validation failed.",
				eventId: args.headers.eventId,
				payloadPreview,
				status: "rejected",
				topic: normalizeWebhookHeaderValue(args.headers.topic) ?? "unknown",
				triggeredAt: args.headers.triggeredAt,
				webhookId: args.headers.webhookId,
			});

			return {
				ok: false,
				reason: validation.reason,
				status: 401,
			};
		}

		try {
			await ctx.runMutation(internal.shopify.ingestWebhook, {
				apiVersion: validation.apiVersion ?? SHOPIFY_API_VERSION,
				deliveryKey: buildWebhookDeliveryKey({
					domain: validation.domain,
					eventId: "eventId" in validation ? validation.eventId : undefined,
					rawBody: args.rawBody,
					topic: validation.topic,
					triggeredAt: validation.triggeredAt,
					webhookId: "webhookId" in validation ? validation.webhookId : undefined,
				}),
				domain: validation.domain,
				eventId: "eventId" in validation ? validation.eventId : undefined,
				payloadPreview,
				topic: validation.topic,
				triggeredAt: validation.triggeredAt,
				webhookId: "webhookId" in validation ? validation.webhookId : undefined,
			});

			return {
				ok: true,
				status: 200,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Shopify webhook ingestion failed.";

			await ctx.runMutation(internal.shopify.recordWebhookFailure, {
				apiVersion: validation.apiVersion ?? SHOPIFY_API_VERSION,
				deliveryKey: buildWebhookDeliveryKey({
					domain: validation.domain,
					eventId: "eventId" in validation ? validation.eventId : undefined,
					rawBody: args.rawBody,
					topic: validation.topic,
					triggeredAt: validation.triggeredAt,
					webhookId: "webhookId" in validation ? validation.webhookId : undefined,
				}),
				domain: validation.domain,
				error: message,
				eventId: "eventId" in validation ? validation.eventId : undefined,
				payloadPreview,
				status: "failed",
				topic: validation.topic,
				triggeredAt: validation.triggeredAt,
				webhookId: "webhookId" in validation ? validation.webhookId : undefined,
			});

			return {
				ok: false,
				reason: message,
				status: 500,
			};
		}
	},
});

export const getInstallationByDomain = internalQuery({
	args: {
		domain: v.string(),
	},
	handler: async (ctx, args) => {
		const shop = await ctx.db
			.query("shops")
			.withIndex("by_domain", (query) => query.eq("domain", args.domain))
			.unique();

		if (!shop) {
			return null;
		}

		const installation = await ctx.db
			.query("shopifyInstallations")
			.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
			.unique();

		if (!installation) {
			return null;
		}

		return {
			accessToken: installation.accessToken ?? undefined,
			accessTokenExpiresAt: installation.accessTokenExpiresAt ?? undefined,
			refreshToken: installation.refreshToken ?? undefined,
			refreshTokenExpiresAt: installation.refreshTokenExpiresAt ?? undefined,
			scopes: installation.scopes,
		};
	},
});

export const persistBootstrap = internalMutation({
	args: {
		accessToken: v.string(),
		accessTokenExpiresAt: v.optional(v.number()),
		actorEmail: v.optional(v.string()),
		actorInitials: v.string(),
		actorName: v.string(),
		installScopes: v.array(v.string()),
		lastAuthenticatedAt: v.number(),
		planDisplayName: v.optional(v.string()),
		refreshToken: v.optional(v.string()),
		refreshTokenExpiresAt: v.optional(v.number()),
		sessionId: v.optional(v.string()),
		shopDomain: v.string(),
		shopName: v.string(),
		shopifyShopId: v.string(),
		shopifyUserId: v.string(),
	},
	handler: async (ctx, args): Promise<SessionEnvelope> => {
		const now = Date.now();
		const existingShop = await ctx.db
			.query("shops")
			.withIndex("by_domain", (query) => query.eq("domain", args.shopDomain))
			.unique();

		let shopId: Id<"shops">;

		if (existingShop) {
			shopId = existingShop._id;
			await ctx.db.patch(existingShop._id, {
				domain: args.shopDomain,
				installStatus: "connected",
				lastAuthenticatedAt: args.lastAuthenticatedAt,
				name: args.shopName,
				planDisplayName: args.planDisplayName,
				shopifyShopId: args.shopifyShopId,
			});
		} else {
			shopId = await ctx.db.insert("shops", {
				createdAt: now,
				domain: args.shopDomain,
				installStatus: "connected",
				lastAuthenticatedAt: args.lastAuthenticatedAt,
				name: args.shopName,
				planDisplayName: args.planDisplayName,
				shopifyShopId: args.shopifyShopId,
			});
		}

		const existingInstallation = await ctx.db
			.query("shopifyInstallations")
			.withIndex("by_shop", (query) => query.eq("shopId", shopId))
			.unique();

		if (existingInstallation) {
			await ctx.db.patch(existingInstallation._id, {
				accessToken: args.accessToken,
				accessTokenExpiresAt: args.accessTokenExpiresAt,
				apiVersion: SHOPIFY_API_VERSION,
				domain: args.shopDomain,
				lastTokenExchangeAt: now,
				refreshToken: args.refreshToken,
				refreshTokenExpiresAt: args.refreshTokenExpiresAt,
				scopes: args.installScopes,
				status: "connected",
			});
		} else {
			await ctx.db.insert("shopifyInstallations", {
				accessToken: args.accessToken,
				accessTokenExpiresAt: args.accessTokenExpiresAt,
				apiVersion: SHOPIFY_API_VERSION,
				createdAt: now,
				domain: args.shopDomain,
				lastTokenExchangeAt: now,
				refreshToken: args.refreshToken,
				refreshTokenExpiresAt: args.refreshTokenExpiresAt,
				scopes: args.installScopes,
				shopId,
				status: "connected",
			});
		}

		const existingActor = await ctx.db
			.query("merchantActors")
			.withIndex("by_shop_and_shopify_user_id", (query) =>
				query.eq("shopId", shopId).eq("shopifyUserId", args.shopifyUserId),
			)
			.unique();

		let actorId: Id<"merchantActors">;

		if (existingActor) {
			actorId = existingActor._id;
			await ctx.db.patch(existingActor._id, {
				email: args.actorEmail,
				initials: args.actorInitials,
				lastAuthenticatedAt: args.lastAuthenticatedAt,
				name: args.actorName,
				sessionId: args.sessionId,
				shopDomain: args.shopDomain,
			});
		} else {
			actorId = await ctx.db.insert("merchantActors", {
				createdAt: now,
				email: args.actorEmail,
				initials: args.actorInitials,
				lastAuthenticatedAt: args.lastAuthenticatedAt,
				name: args.actorName,
				sessionId: args.sessionId,
				shopDomain: args.shopDomain,
				shopId,
				shopifyUserId: args.shopifyUserId,
			});
		}

		const existingWidgetConfig = await ctx.db
			.query("widgetConfigs")
			.withIndex("by_shop", (query) => query.eq("shopId", shopId))
			.unique();

		if (!existingWidgetConfig) {
			await ctx.db.insert("widgetConfigs", {
				accentColor: DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
				createdAt: now,
				enabled: true,
				greeting: DEFAULT_STOREFRONT_WIDGET_GREETING,
				knowledgeSources: DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
				position: DEFAULT_STOREFRONT_WIDGET_POSITION,
				shopId,
				updatedAt: now,
			});
		}

		await ctx.db.insert("auditLogs", {
			action: "shopify.bootstrap.completed",
			actorId,
			createdAt: now,
			detail: "Embedded merchant bootstrap exchanged tokens and refreshed shop context.",
			payload: {
				scopes: args.installScopes,
				sessionId: args.sessionId,
				shopDomain: args.shopDomain,
			},
			shopId,
			status: "success",
		});

		await ctx.runMutation(internal.shopifySync.queueSyncJob, {
			domain: args.shopDomain,
			pendingReason: "Bootstrap requested an initial Shopify cache reconciliation.",
			shopId,
			source: "bootstrap",
			type: "reconciliation_scan",
		});

		const shopDoc = (await ctx.db.get(shopId))!;
		const actorDoc = (await ctx.db.get(actorId))!;

		return await createSessionEnvelope({
			actor: actorDoc,
			roles: ["shop_admin"],
			shop: shopDoc,
		});
	},
});

export const ingestWebhook = internalMutation({
	args: {
		apiVersion: v.string(),
		deliveryKey: v.string(),
		domain: v.string(),
		eventId: v.optional(v.string()),
		payloadPreview: v.optional(v.string()),
		topic: v.string(),
		triggeredAt: v.optional(v.string()),
		webhookId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const existingByDeliveryKey = await ctx.db
			.query("webhookDeliveries")
			.withIndex("by_delivery_key", (query) => query.eq("deliveryKey", args.deliveryKey))
			.unique();

		if (existingByDeliveryKey) {
			return existingByDeliveryKey._id;
		}

		if (args.webhookId) {
			const duplicateByWebhookId = await ctx.db
				.query("webhookDeliveries")
				.withIndex("by_webhook_id", (query) => query.eq("webhookId", args.webhookId))
				.unique();

			if (duplicateByWebhookId) {
				return duplicateByWebhookId._id;
			}
		}

		if (args.eventId) {
			const duplicateByEventId = await ctx.db
				.query("webhookDeliveries")
				.withIndex("by_event_id", (query) => query.eq("eventId", args.eventId))
				.unique();

			if (duplicateByEventId) {
				return duplicateByEventId._id;
			}
		}

		let shop = await ctx.db
			.query("shops")
			.withIndex("by_domain", (query) => query.eq("domain", args.domain))
			.unique();

		if (!shop && args.topic !== "app/uninstalled") {
			const shopId = await ctx.db.insert("shops", {
				createdAt: now,
				domain: args.domain,
				installStatus: "pending",
				name: args.domain,
			});
			shop = (await ctx.db.get(shopId))!;
		}

		const deliveryId = await ctx.db.insert("webhookDeliveries", {
			apiVersion: args.apiVersion,
			deliveryKey: args.deliveryKey,
			domain: args.domain,
			eventId: args.eventId,
			processedAt: now,
			receivedAt: now,
			shopId: shop?._id,
			status: "processed",
			topic: args.topic,
			triggeredAt: args.triggeredAt,
			webhookId: args.webhookId,
		});

		if (args.payloadPreview) {
			await ctx.db.insert("webhookPayloads", {
				createdAt: now,
				deliveryId,
				payloadPreview: args.payloadPreview,
			});
		}

		if (shop) {
			await ctx.db.insert("auditLogs", {
				action: `shopify.webhook.${args.topic}`,
				createdAt: now,
				detail: "Inbound Shopify webhook processed by Convex.",
				payload: {
					eventId: args.eventId,
					webhookId: args.webhookId,
				},
				shopId: shop._id,
				status: "success",
			});
		}

		if (!shop) {
			return deliveryId;
		}

		if (args.topic === "app/uninstalled") {
			await ctx.db.patch(shop._id, {
				installStatus: "inactive",
			});

			const installation = await ctx.db
				.query("shopifyInstallations")
				.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
				.unique();

			if (installation) {
				await ctx.db.patch(installation._id, {
					status: "inactive",
				});
			}

			await ctx.runMutation(internal.shopifySync.queueSyncJob, {
				domain: shop.domain,
				payloadPreview: "Shop uninstall cleanup requested.",
				pendingReason: "App uninstall webhook requested cache and token cleanup.",
				shopId: shop._id,
				source: "webhook",
				triggeredByDeliveryId: deliveryId,
				type: "shop_uninstall_cleanup",
				webhookReceivedAt: now,
			});

			return deliveryId;
		}

		if (
			args.topic.startsWith("products/") ||
			args.topic.startsWith("collections/") ||
			args.topic === "inventory_levels/update"
		) {
			await ctx.runMutation(internal.shopifySync.queueSyncJob, {
				cacheKey: "public_catalog_index",
				domain: shop.domain,
				payloadPreview: args.payloadPreview,
				pendingReason: `Webhook ${args.topic} requested a deterministic catalog index rebuild.`,
				shopId: shop._id,
				source: "webhook",
				triggeredByDeliveryId: deliveryId,
				type: "catalog_index_rebuild",
				webhookReceivedAt: now,
			});
			await ctx.runMutation(internal.shopifySync.queueSyncJob, {
				cacheKey: "merchant_metrics_cache",
				domain: shop.domain,
				payloadPreview: args.payloadPreview,
				pendingReason: `Webhook ${args.topic} requested a merchant metrics refresh.`,
				shopId: shop._id,
				source: "webhook",
				triggeredByDeliveryId: deliveryId,
				type: "metrics_cache_refresh",
				webhookReceivedAt: now,
			});
		}

		if (args.topic.startsWith("orders/") || args.topic === "app/scopes_update") {
			await ctx.runMutation(internal.shopifySync.queueSyncJob, {
				cacheKey: "merchant_metrics_cache",
				domain: shop.domain,
				payloadPreview: args.payloadPreview,
				pendingReason: `Webhook ${args.topic} requested a merchant metrics refresh.`,
				shopId: shop._id,
				source: "webhook",
				triggeredByDeliveryId: deliveryId,
				type: "metrics_cache_refresh",
				webhookReceivedAt: now,
			});
		}

		if (args.topic === "app/scopes_update") {
			await ctx.runMutation(internal.shopifySync.queueSyncJob, {
				domain: shop.domain,
				payloadPreview: args.payloadPreview,
				pendingReason: "Scope changes requested a Shopify cache reconciliation scan.",
				shopId: shop._id,
				source: "webhook",
				triggeredByDeliveryId: deliveryId,
				type: "reconciliation_scan",
				webhookReceivedAt: now,
			});
		}

		return deliveryId;
	},
});

export const recordWebhookFailure = internalMutation({
	args: {
		apiVersion: v.optional(v.string()),
		deliveryKey: v.string(),
		domain: v.string(),
		error: v.string(),
		eventId: v.optional(v.string()),
		payloadPreview: v.optional(v.string()),
		status: v.string(),
		topic: v.string(),
		triggeredAt: v.optional(v.string()),
		webhookId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("webhookDeliveries")
			.withIndex("by_delivery_key", (query) => query.eq("deliveryKey", args.deliveryKey))
			.unique();

		if (existing) {
			return existing._id;
		}

		const now = Date.now();
		const shop = await ctx.db
			.query("shops")
			.withIndex("by_domain", (query) => query.eq("domain", args.domain))
			.unique();
		const deliveryId = await ctx.db.insert("webhookDeliveries", {
			apiVersion: args.apiVersion,
			deliveryKey: args.deliveryKey,
			domain: args.domain,
			error: args.error,
			eventId: args.eventId,
			processedAt: now,
			receivedAt: now,
			shopId: shop?._id,
			status: args.status,
			topic: args.topic,
			triggeredAt: args.triggeredAt,
			webhookId: args.webhookId,
		});

		if (args.payloadPreview) {
			await ctx.db.insert("webhookPayloads", {
				createdAt: now,
				deliveryId,
				payloadPreview: args.payloadPreview,
			});
		}

		if (shop) {
			await ctx.db.insert("auditLogs", {
				action: `shopify.webhook.${args.topic}`,
				createdAt: now,
				detail: "Inbound Shopify webhook failed validation or processing.",
				payload: {
					error: args.error,
					webhookId: args.webhookId,
				},
				shopId: shop._id,
				status: "error",
			});
		}

		return deliveryId;
	},
});
