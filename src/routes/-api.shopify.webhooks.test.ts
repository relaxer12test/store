import { describe, expect, it } from "vitest";
import { buildForwardedHeaders } from "./api.shopify.webhooks";

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
});
