import { describe, expect, it } from "vitest";
import { getShopifyAccessFailureReason, hasConnectedShopifyAccess } from "./shopifyAccess";

describe("shopifyAccess", () => {
	it("allows only connected shops with connected offline tokens", () => {
		expect(
			hasConnectedShopifyAccess({
				installation: {
					accessToken: "shpat_123",
					status: "connected",
				},
				shop: {
					installStatus: "connected",
				},
			}),
		).toBe(true);

		expect(
			hasConnectedShopifyAccess({
				installation: {
					accessToken: "shpat_123",
					status: "inactive",
				},
				shop: {
					installStatus: "connected",
				},
			}),
		).toBe(false);
	});

	it("returns clear failure reasons for disconnected shops and missing tokens", () => {
		expect(
			getShopifyAccessFailureReason({
				actionLabel: "execute this approval",
				installation: {
					accessToken: "stale",
					status: "inactive",
				},
				shop: {
					domain: "acme.myshopify.com",
					installStatus: "inactive",
				},
			}),
		).toContain("no longer connected");

		expect(
			getShopifyAccessFailureReason({
				actionLabel: "use the merchant copilot",
				installation: {
					accessToken: null,
					status: "connected",
				},
				shop: {
					domain: "acme.myshopify.com",
					installStatus: "connected",
				},
			}),
		).toContain("offline Shopify Admin token is unavailable");
	});
});
