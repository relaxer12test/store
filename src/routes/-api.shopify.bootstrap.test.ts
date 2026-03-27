import { afterEach, describe, expect, it, vi } from "vitest";
import { bootstrapShopifyMerchantSession } from "@/lib/api-proxy";

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
			return new Response(null, {
				headers: {
					"set-cookie":
						"session_token=ba-session; Path=/; HttpOnly; Max-Age=3600, better-auth.convex_jwt=convex-token; Path=/; HttpOnly; Max-Age=3600",
				},
				status: 204,
			});
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
		expect(response.status).toBe(204);
		expect(response.headers.get("set-cookie")).toContain("convex_jwt=convex-token");
		expect(await response.text()).toBe("");
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
