import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapShopifyMerchantSession } from "./api.shopify.bootstrap";

describe("shopify bootstrap route", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects requests without a Shopify session token", async () => {
		const response = await bootstrapShopifyMerchantSession(
			new Request("https://storeai.ldev.cloud"),
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: "Missing Shopify session token.",
		});
	});

	it("proxies the Convex bootstrap response and forwards auth cookies", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
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
						id: "member_123",
						initials: "JD",
						name: "Jane Doe",
						roles: ["shop_admin"],
					},
				}),
				{
					headers: {
						"set-cookie":
							"session_token=ba-session; Path=/; HttpOnly; Max-Age=3600, better-auth.convex_jwt=convex-token; Path=/; HttpOnly; Max-Age=3600",
					},
					status: 200,
				},
			);
		});

		const response = await bootstrapShopifyMerchantSession(
			new Request("https://storeai.ldev.cloud", {
				headers: {
					Authorization: "Bearer session-token",
				},
			}),
			{
				fetchImpl,
			},
		);

		expect(fetchImpl).toHaveBeenCalledTimes(1);
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
				id: "member_123",
				initials: "JD",
				name: "Jane Doe",
				roles: ["shop_admin"],
			},
		});
	});

	it("passes through Convex bootstrap failures", async () => {
		const fetchImpl = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					error: "Invalid merchant bridge request.",
				}),
				{
					headers: {
						"cache-control": "no-store",
						"content-type": "application/json",
					},
					status: 401,
				},
			);
		});

		const response = await bootstrapShopifyMerchantSession(
			new Request("https://storeai.ldev.cloud", {
				headers: {
					Authorization: "Bearer session-token",
				},
			}),
			{
				fetchImpl,
			},
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: "Invalid merchant bridge request.",
		});
	});
});
