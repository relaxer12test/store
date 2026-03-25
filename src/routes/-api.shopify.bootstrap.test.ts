import { describe, expect, it, vi } from "vitest";
import { forwardShopifyBootstrapRequest } from "./api.shopify.bootstrap";

describe("shopify bootstrap route", () => {
	it("rejects requests without a Shopify session token", async () => {
		const response = await forwardShopifyBootstrapRequest(
			new Request("https://storeai.ldev.cloud"),
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toEqual({
			error: "Missing Shopify session token.",
		});
	});

	it("forwards authenticated bootstrap requests to Convex", async () => {
		const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));

		await forwardShopifyBootstrapRequest(
			new Request("https://storeai.ldev.cloud", {
				headers: {
					Authorization: "Bearer session-token",
				},
			}),
			{
				convexUrl: "https://convex.example",
				fetchImpl,
			},
		);

		expect(fetchImpl).toHaveBeenCalledWith("https://convex.example/shopify/bootstrap", {
			headers: {
				Accept: "application/json",
				Authorization: "Bearer session-token",
			},
			method: "POST",
		});
	});
});
