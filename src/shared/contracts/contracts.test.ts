import { describe, expect, it } from "vitest";
import { dashboardSpecSchema } from "./merchant-workspace";
import { cartPlanSchema } from "./storefront-widget";

describe("shared contract schemas", () => {
	it("validates storefront cart plans", () => {
		expect(
			cartPlanSchema.parse({
				explanation: "Starter bundle",
				items: [
					{
						productHandle: "trail-pack",
						productTitle: "Trail Pack",
						productUrl: "https://store.example/products/trail-pack",
						quantity: 1,
						variantId: "gid://shopify/ProductVariant/1",
						variantTitle: "Default",
					},
				],
				note: "Safe public bundle",
			}),
		).toMatchObject({
			items: [{ productHandle: "trail-pack" }],
		});

		expect(() =>
			cartPlanSchema.parse({
				items: [],
			}),
		).toThrow();
	});

	it("validates deterministic dashboard specs", () => {
		expect(
			dashboardSpecSchema.parse({
				cards: [
					{
						description: "Revenue over the recent window.",
						id: "revenue",
						tone: "success",
						type: "metric",
						value: "$1,250",
						valueLabel: "Revenue",
					},
				],
				description: "Merchant overview",
				generatedAt: new Date("2026-03-25T12:00:00Z").toISOString(),
				title: "Dashboard",
			}),
		).toMatchObject({
			title: "Dashboard",
		});

		expect(() =>
			dashboardSpecSchema.parse({
				cards: [
					{
						description: "Bad card",
						id: "revenue",
						tone: "loud",
						type: "metric",
						value: "$1,250",
						valueLabel: "Revenue",
					},
				],
				description: "Merchant overview",
				generatedAt: new Date("2026-03-25T12:00:00Z").toISOString(),
				title: "Dashboard",
			}),
		).toThrow();
	});
});
