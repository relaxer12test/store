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

	it("creates an embedded session from the Shopify bridge and forwards auth cookies", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);

			if (url.pathname === "/api/auth/sign-in/shopify-bridge") {
				return new Response(
					JSON.stringify({
						activeShop: {
							domain: "acme.myshopify.com",
							id: "shop_123",
							installStatus: "connected",
							name: "Acme",
						},
						betterAuthRole: "user",
						merchantRole: "admin",
						viewer: {
							email: "merchant@example.com",
							id: "member_123",
							initials: "JD",
							name: "Jane Doe",
						},
					}),
					{
						headers: {
							"set-cookie": "session_token=ba-session; Path=/; HttpOnly; Max-Age=3600",
						},
					},
				);
			}

			return new Response(
				JSON.stringify({
					token: "convex-token",
				}),
				{
					headers: {
						"set-cookie": "better-auth.convex_jwt=convex-token; Path=/; HttpOnly; Max-Age=3600",
					},
				},
			);
		});
		vi.stubGlobal("fetch", fetchMock);
		const convexBootstrap = vi.fn(async () => ({
			activeShop: {
				domain: "acme.myshopify.com",
				id: "shop_123",
				installStatus: "connected",
				name: "Acme",
			},
			bridgeRequest: {
				initials: "JD",
				lastAuthenticatedAt: 1_800_000_000_000,
				name: "Jane Doe",
				shopDomain: "acme.myshopify.com",
				shopId: "shop_123",
				shopName: "Acme",
				shopifyUserId: "shopify-user-1",
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
		expect(fetchMock).toHaveBeenCalledTimes(2);
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
			convexTokenExpiresAt: null,
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

	it("logs bootstrap failures when Convex does not issue a merchant token", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);

			if (url.pathname === "/api/auth/sign-in/shopify-bridge") {
				return new Response(
					JSON.stringify({
						activeShop: {
							domain: "acme.myshopify.com",
							id: "shop_123",
							installStatus: "connected",
							name: "Acme",
						},
						betterAuthRole: "user",
						merchantRole: "admin",
						viewer: {
							email: "merchant@example.com",
							id: "member_123",
							initials: "JD",
							name: "Jane Doe",
						},
					}),
					{
						headers: {
							"set-cookie": "session_token=ba-session; Path=/; HttpOnly; Max-Age=3600",
						},
					},
				);
			}

			return new Response(
				JSON.stringify({
					error: "Merchant bootstrap completed without issuing a Convex JWT.",
				}),
				{
					status: 500,
				},
			);
		});
		vi.stubGlobal("fetch", fetchMock);
		const convexBootstrap = vi.fn(async () => ({
			activeShop: {
				domain: "acme.myshopify.com",
				id: "shop_123",
				installStatus: "connected",
				name: "Acme",
			},
			bridgeRequest: {
				initials: "JD",
				lastAuthenticatedAt: 1_800_000_000_000,
				name: "Jane Doe",
				shopDomain: "acme.myshopify.com",
				shopId: "shop_123",
				shopName: "Acme",
				shopifyUserId: "shopify-user-1",
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

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Merchant bootstrap completed without issuing a Convex JWT.",
		});
	});
});
