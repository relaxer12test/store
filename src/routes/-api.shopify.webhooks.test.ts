import { describe, expect, it } from "vitest";
import { buildForwardedHeaders, forwardShopifyWebhookRequest } from "./api.shopify.webhooks";

describe("shopify webhook route", () => {
	it("forwards only Shopify verification headers and content type", () => {
		const request = new Request("https://storeai.ldev.cloud", {
			headers: {
				Authorization: "Bearer secret",
				"Content-Type": "application/json",
				"X-Other": "skip-me",
				"X-Shopify-Hmac-Sha256": "hmac",
				"X-Shopify-Topic": "products/update",
			},
		});

		const headers = buildForwardedHeaders(request);

		expect(headers.get("Content-Type")).toBe("application/json");
		expect(headers.get("X-Shopify-Hmac-Sha256")).toBe("hmac");
		expect(headers.get("X-Shopify-Topic")).toBe("products/update");
		expect(headers.get("Authorization")).toBeNull();
		expect(headers.get("X-Other")).toBeNull();
	});

	it("forwards webhook bodies to the Convex HTTP actions host", async () => {
		const calls: Array<{
			init?: RequestInit;
			url: string;
		}> = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

			calls.push({
				init,
				url,
			});

			return new Response(null, { status: 202 });
		};
		const request = new Request("https://storeai.ldev.cloud/api/shopify/webhooks", {
			body: JSON.stringify({
				ping: true,
			}),
			headers: {
				"Content-Type": "application/json",
				"X-Shopify-Topic": "products/update",
			},
			method: "POST",
		});

		const response = await forwardShopifyWebhookRequest(request, {
			convexUrl: "https://convex.example",
			fetchImpl,
		});

		expect(response.status).toBe(202);
		expect(calls).toHaveLength(1);
		const firstCall = calls[0];

		expect(firstCall).toBeDefined();

		if (!firstCall) {
			throw new Error("Expected the webhook route to forward the request.");
		}

		const headers = new Headers(firstCall.init?.headers);

		expect(firstCall.url).toBe("https://convex.example/shopify/webhooks");
		expect(firstCall.init?.method).toBe("POST");

		expect(headers.get("Content-Type")).toBe("application/json");
		expect(headers.get("X-Shopify-Topic")).toBe("products/update");
	});
});
