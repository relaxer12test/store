import { describe, expect, it, vi } from "vitest";
import { forwardStorefrontWidgetConfigRequest } from "./api.shopify.widget";

describe("shopify storefront widget config route", () => {
	it("forwards config requests to the Convex HTTP actions host", async () => {
		const fetchImpl = vi.fn(async () =>
			Response.json({
				enabled: false,
			}),
		);

		const response = await forwardStorefrontWidgetConfigRequest(
			new Request("https://storeai.ldev.cloud/api/shopify/widget?shop=acme.myshopify.com"),
			{
				convexUrl: "https://convex.example",
				fetchImpl,
			},
		);

		expect(fetchImpl).toHaveBeenCalledWith(
			"https://convex.example/shopify/widget?shop=acme.myshopify.com",
			{
				headers: {
					Accept: "application/json",
				},
				method: "GET",
			},
		);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		await expect(response.json()).resolves.toEqual({
			enabled: false,
		});
	});

	it("normalizes empty upstream failures into JSON errors", async () => {
		const response = await forwardStorefrontWidgetConfigRequest(
			new Request("https://storeai.ldev.cloud/api/shopify/widget?shop=acme.myshopify.com"),
			{
				convexUrl: "https://convex.example",
				fetchImpl: vi.fn(async () => new Response(null, { status: 404, statusText: "Not Found" })),
			},
		);

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: "Storefront widget configuration failed upstream with status 404.",
		});
	});
});
