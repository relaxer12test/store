import { describe, expect, it, vi } from "vitest";
import { bootstrapShopifyMerchantSession } from "./api.shopify.bootstrap";

describe("shopify bootstrap route", () => {
	it("rejects requests without a Shopify session token", async () => {
		const response = await bootstrapShopifyMerchantSession(
			new Request("https://storeai.ldev.cloud"),
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: "Missing Shopify session token.",
		});
	});

	it("creates an embedded session from the Shopify bridge and forwards auth cookies", async () => {
		const convexBootstrap = vi.fn(async () => ({
			merchantSession: {
				expiresAt: 1_800_000_000_000,
				token: "convex-token",
			},
			persistedBootstrap: {
				activeShop: {
					domain: "acme.myshopify.com",
					id: "shop_123",
					installStatus: "connected",
					name: "Acme",
				},
				roles: ["shop_admin"],
				viewer: {
					email: "merchant@example.com",
					id: "actor_123",
					initials: "JD",
					name: "Jane Doe",
					roles: ["shop_admin"],
				},
			},
		}));

		const response = await bootstrapShopifyMerchantSession(
			new Request("https://storeai.ldev.cloud", {
				headers: {
					Authorization: "Bearer session-token",
				},
			}),
			{
				convexBootstrap: convexBootstrap as (sessionToken: string) => Promise<any>,
			},
		);

		expect(convexBootstrap).toHaveBeenCalledWith("session-token");
		expect(response.status).toBe(200);
		expect(response.headers.get("set-cookie")).toContain("convex_jwt=convex-token");
		await expect(response.json()).resolves.toEqual({
			activeShop: {
				domain: "acme.myshopify.com",
				id: "shop_123",
				installStatus: "connected",
				name: "Acme",
			},
			authMode: "embedded",
			convexToken: "convex-token",
			convexTokenExpiresAt: 1_800_000_000_000,
			roles: ["shop_admin"],
			state: "ready",
			viewer: {
				email: "merchant@example.com",
				id: "actor_123",
				initials: "JD",
				name: "Jane Doe",
				roles: ["shop_admin"],
			},
		});
	});

	it("logs bootstrap failures when Convex does not issue a merchant token", async () => {
		const logger = {
			error: vi.fn(),
		};
		const convexBootstrap = vi.fn(async () => ({
			merchantSession: {
				expiresAt: 1_800_000_000_000,
				token: "",
			},
			persistedBootstrap: {
				activeShop: {
					domain: "acme.myshopify.com",
					id: "shop_123",
					installStatus: "connected",
					name: "Acme",
				},
				roles: ["shop_admin"],
				viewer: {
					email: "merchant@example.com",
					id: "actor_123",
					initials: "JD",
					name: "Jane Doe",
					roles: ["shop_admin"],
				},
			},
		}));

		const response = await bootstrapShopifyMerchantSession(
			new Request("https://storeai.ldev.cloud", {
				headers: {
					Authorization: "Bearer session-token",
				},
			}),
			{
				convexBootstrap: convexBootstrap as (sessionToken: string) => Promise<any>,
				logger,
			},
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Merchant bootstrap completed without issuing a Convex JWT.",
		});
		expect(logger.error).toHaveBeenCalledWith(
			"[shopify-merchant-auth] bootstrap_missing_convex_token",
			expect.objectContaining({
				merchantActorId: "actor_123",
				shopDomain: "acme.myshopify.com",
				stage: "issue_convex_jwt",
			}),
		);
	});
});
