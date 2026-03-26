import type { Session } from "@shopify/shopify-api";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildPersistBootstrapResult,
	buildWebhookDeliveryKey,
	getWebhookSyncPlans,
	sessionToInstallation,
	shouldRefreshInstallation,
} from "./shopify";

describe("shopify webhook planning", () => {
	it("maps product webhooks to catalog and metrics refresh jobs", () => {
		expect(getWebhookSyncPlans("products/update")).toEqual([
			{
				cacheKey: "public_catalog_index",
				pendingReason: "Webhook products/update requested a deterministic catalog index rebuild.",
				type: "catalog_index_rebuild",
			},
			{
				cacheKey: "merchant_metrics_cache",
				pendingReason: "Webhook products/update requested a merchant metrics refresh.",
				type: "metrics_cache_refresh",
			},
		]);
	});

	it("maps uninstall and scope updates to cleanup and reconciliation work", () => {
		expect(getWebhookSyncPlans("app/uninstalled")).toEqual([
			{
				pendingReason: "App uninstall webhook requested cache and token cleanup.",
				type: "shop_uninstall_cleanup",
			},
		]);

		expect(getWebhookSyncPlans("app/scopes_update")).toEqual([
			{
				cacheKey: "merchant_metrics_cache",
				pendingReason: "Webhook app/scopes_update requested a merchant metrics refresh.",
				type: "metrics_cache_refresh",
			},
			{
				pendingReason: "Scope changes requested a Shopify cache reconciliation scan.",
				type: "reconciliation_scan",
			},
		]);
	});
});

describe("shopify installation helpers", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("derives stable webhook delivery keys", () => {
		expect(
			buildWebhookDeliveryKey({
				domain: "acme.myshopify.com",
				rawBody: '{"id":1}',
				topic: "products/update",
				webhookId: "wh_123",
			}),
		).toBe("acme.myshopify.com::products/update::wh_123");
	});

	it("requests token refresh only when the access token is near expiry and refresh is still valid", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-03-25T12:00:00Z"));

		expect(
			shouldRefreshInstallation({
				accessTokenExpiresAt: Date.now() + 60_000,
				refreshToken: "refresh-token",
				refreshTokenExpiresAt: Date.now() + 30 * 60_000,
			}),
		).toBe(true);

		expect(
			shouldRefreshInstallation({
				accessTokenExpiresAt: Date.now() + 60_000,
				refreshToken: "refresh-token",
				refreshTokenExpiresAt: Date.now() + 60_000,
			}),
		).toBe(false);
	});

	it("normalizes exchanged Shopify session data into installation fields", () => {
		const session = {
			accessToken: "access-token",
			expires: new Date("2026-03-25T12:30:00Z"),
			refreshToken: "refresh-token",
			refreshTokenExpires: new Date("2026-03-26T12:00:00Z"),
			scope: "read_products, write_products",
		} as Session;

		expect(sessionToInstallation(session)).toEqual({
			accessToken: "access-token",
			accessTokenExpiresAt: new Date("2026-03-25T12:30:00Z").getTime(),
			refreshToken: "refresh-token",
			refreshTokenExpiresAt: new Date("2026-03-26T12:00:00Z").getTime(),
			scopes: ["read_products", "write_products"],
		});
	});

	it("builds token claims and ready session summaries without reading from the database", () => {
		expect(
			buildPersistBootstrapResult({
				actorEmail: "merchant@example.com",
				actorInitials: "JD",
				actorName: "Jane Doe",
				lastAuthenticatedAt: 1_800_000_000_000,
				planDisplayName: "Basic",
				sessionId: "session_123",
				shopDomain: "acme.myshopify.com",
				shopId: "shop_123" as any,
				shopName: "Acme",
				shopifyShopId: "gid://shopify/Shop/1",
				shopifyUserId: "shopify-user-1",
			}),
		).toEqual({
			activeShop: {
				domain: "acme.myshopify.com",
				id: "shop_123",
				installStatus: "connected",
				name: "Acme",
			},
			bridgeRequest: {
				email: "merchant@example.com",
				initials: "JD",
				lastAuthenticatedAt: 1_800_000_000_000,
				name: "Jane Doe",
				planDisplayName: "Basic",
				sessionId: "session_123",
				shopDomain: "acme.myshopify.com",
				shopId: "shop_123",
				shopName: "Acme",
				shopifyShopId: "gid://shopify/Shop/1",
				shopifyUserId: "shopify-user-1",
			},
		});
	});
});
