import { describe, expect, it } from "vitest";
import { buildEmbeddedAppContentSecurityPolicy, getEmbeddedFrameAncestors } from "./server";

function encodeHost(value: string) {
	return Buffer.from(value, "utf8").toString("base64url");
}

describe("embedded session headers", () => {
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

	it("locks non-embedded HTML out of framing", () => {
		const url = new URL("https://storeai.ldev.cloud/install");

		expect(getEmbeddedFrameAncestors(url)).toEqual(["'none'"]);
	});
});
