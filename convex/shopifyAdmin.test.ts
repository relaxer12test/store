import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildThemeEditorAppEmbedDeepLink,
	parseThemeAppEmbedStatus,
	STOREFRONT_APP_EMBED_BLOCK_HANDLE,
} from "./shopifyAdmin";

const originalShopifyApiKey = process.env.SHOPIFY_API_KEY;

describe("shopify theme app embed diagnostics", () => {
	beforeEach(() => {
		process.env.SHOPIFY_API_KEY = "test-api-key";
	});

	afterEach(() => {
		process.env.SHOPIFY_API_KEY = originalShopifyApiKey;
	});

	it("detects enabled and disabled embed states from theme settings", () => {
		expect(
			parseThemeAppEmbedStatus(
				JSON.stringify({
					current: {
						blocks: {
							a: {
								disabled: false,
								type: `shopify://apps/example/blocks/${STOREFRONT_APP_EMBED_BLOCK_HANDLE}/123`,
							},
						},
					},
				}),
				STOREFRONT_APP_EMBED_BLOCK_HANDLE,
			),
		).toBe("enabled");

		expect(
			parseThemeAppEmbedStatus(
				JSON.stringify({
					current: {
						blocks: {
							a: {
								disabled: true,
								type: `shopify://apps/example/blocks/${STOREFRONT_APP_EMBED_BLOCK_HANDLE}/123`,
							},
						},
					},
				}),
				STOREFRONT_APP_EMBED_BLOCK_HANDLE,
			),
		).toBe("disabled");
	});

	it("builds a theme editor deep link that activates the app embed", () => {
		const url = buildThemeEditorAppEmbedDeepLink("acme.myshopify.com");

		expect(url).toContain("https://acme.myshopify.com/admin/themes/current/editor");
		expect(url).toContain("context=apps");
		expect(url).toContain(encodeURIComponent(`test-api-key/${STOREFRONT_APP_EMBED_BLOCK_HANDLE}`));
	});
});
