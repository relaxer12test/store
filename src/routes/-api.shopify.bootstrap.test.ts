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
			bridgePayload: {
				email: "merchant@example.com",
				merchantActorId: "actor_123",
				name: "Jane Doe",
				shopDomain: "acme.myshopify.com",
				shopifyUserId: "shopify-user-1",
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
		const fetchImpl = vi.fn(async () => {
			const headers = new Headers();

			headers.append("Set-Cookie", "better-auth.session_token=session-token; Path=/; HttpOnly");
			headers.append("Set-Cookie", "convex_jwt=convex-token; Path=/; HttpOnly");

			return new Response(
				JSON.stringify({
					user: {
						email: "merchant@example.com",
						role: "admin",
					},
				}),
				{
					headers,
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
				authSecret: "bridge-secret",
				convexBootstrap: convexBootstrap as (sessionToken: string) => Promise<any>,
				fetchImpl,
			},
		);

		expect(convexBootstrap).toHaveBeenCalledWith("session-token");
		expect(fetchImpl).toHaveBeenCalledTimes(1);

		const [bridgeUrl, bridgeInit] = fetchImpl.mock.calls[0] as [URL, RequestInit];

		expect(bridgeUrl).toEqual(
			new URL("https://storeai.ldev.cloud/api/auth/sign-in/shopify-bridge"),
		);
		expect(bridgeInit).toMatchObject({
			body: JSON.stringify({
				email: "merchant@example.com",
				merchantActorId: "actor_123",
				name: "Jane Doe",
				shopDomain: "acme.myshopify.com",
				shopifyUserId: "shopify-user-1",
			}),
			method: "POST",
		});
		expect(bridgeInit.headers).toEqual(
			expect.objectContaining({
				Accept: "application/json",
				"Content-Type": "application/json",
				"x-shopify-bridge-secret": "bridge-secret",
				"x-shopify-bootstrap-request-id": expect.any(String),
			}),
		);
		expect(response.status).toBe(200);
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
			roles: ["shop_admin", "admin"],
			state: "ready",
			viewer: {
				email: "merchant@example.com",
				id: "actor_123",
				initials: "JD",
				name: "Jane Doe",
				roles: ["shop_admin", "admin"],
			},
		});
	});

	it("logs bridge failures when Better Auth does not issue the Convex JWT cookie", async () => {
		const logger = {
			error: vi.fn(),
		};
		const convexBootstrap = vi.fn(async () => ({
			bridgePayload: {
				email: "merchant@example.com",
				merchantActorId: "actor_123",
				name: "Jane Doe",
				shopDomain: "acme.myshopify.com",
				shopifyUserId: "shopify-user-1",
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
		const fetchImpl = vi.fn(async () => {
			const headers = new Headers();

			headers.append("Set-Cookie", "better-auth.session_token=session-token; Path=/; HttpOnly");

			return new Response(
				JSON.stringify({
					user: {
						email: "merchant@example.com",
						role: "admin",
					},
				}),
				{
					headers,
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
				authSecret: "bridge-secret",
				convexBootstrap: convexBootstrap as (sessionToken: string) => Promise<any>,
				fetchImpl,
				logger,
			},
		);

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Merchant auth bridge completed without issuing a Convex JWT.",
		});
		expect(logger.error).toHaveBeenCalledWith(
			"[shopify-merchant-auth] bootstrap_missing_convex_jwt_cookie",
			expect.objectContaining({
				authUserEmailPresent: true,
				authUserRole: "admin",
				merchantActorId: "actor_123",
				setCookieNames: ["better-auth.session_token"],
				shopDomain: "acme.myshopify.com",
				stage: "parse_bridge_session",
			}),
		);
	});
});
