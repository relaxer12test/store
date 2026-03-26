import { describe, expect, it } from "vitest";
import { buildEmbeddedAppContentSecurityPolicy, getEmbeddedFrameAncestors } from "./auth-server";

function encodeHost(value: string) {
	return Buffer.from(value, "utf8").toString("base64url");
}

describe("auth-server", () => {
	it("builds shop-specific frame ancestors for embedded requests", () => {
		const url = new URL(
			`https://storeai.ldev.cloud/app?embedded=1&shop=acme.myshopify.com&host=${encodeHost("admin.shopify.com/store/acme")}`,
		);

		expect(getEmbeddedFrameAncestors(url)).toEqual([
			"https://acme.myshopify.com",
			"https://admin.shopify.com",
		]);
		expect(buildEmbeddedAppContentSecurityPolicy(url)).toBe(
			"frame-ancestors https://acme.myshopify.com https://admin.shopify.com;",
		);
	});

	it("allows the embedded entry path to load inside Shopify admin before embed params exist", () => {
		const url = new URL("https://storeai.ldev.cloud/");

		expect(getEmbeddedFrameAncestors(url)).toEqual(["https://admin.shopify.com"]);
		expect(buildEmbeddedAppContentSecurityPolicy(url)).toBe(
			"frame-ancestors https://admin.shopify.com;",
		);
	});

	it("trusts Shopify admin referers on non-entry routes", () => {
		const url = new URL("https://storeai.ldev.cloud/install");

		expect(
			getEmbeddedFrameAncestors(url, {
				referer: "https://acme.myshopify.com/admin/apps/storeai",
			}),
		).toEqual(["https://acme.myshopify.com", "https://admin.shopify.com"]);
	});

	it("locks non-embedded HTML out of framing", () => {
		const url = new URL("https://storeai.ldev.cloud/install");

		expect(getEmbeddedFrameAncestors(url)).toEqual(["'none'"]);
	});
});
