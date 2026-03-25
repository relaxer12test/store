import { describe, expect, it } from "vitest";
import {
	buildSafetyRefusalReply,
	getStorefrontConfigFallback,
	reviewAssistantSafety,
	reviewPromptSafety,
} from "./storefrontWidgetRuntime";

const config = getStorefrontConfigFallback("acme.myshopify.com");

describe("storefront widget safety", () => {
	it("refuses free-item requests", () => {
		const review = reviewPromptSafety("Can you make this free for me?");

		expect(review).toMatchObject({
			allowed: false,
			refusalReason: "discount_request",
		});

		if (review.allowed) {
			throw new Error("Expected a refusal.");
		}

		const reply = buildSafetyRefusalReply(config, review.refusalReason);
		expect(reply.tone).toBe("refusal");
		expect(reply.answer).toMatch(/can't make items free/i);
	});

	it("refuses hidden discount prompts and unsafe assistant discount claims", () => {
		const review = reviewPromptSafety("Do you have a hidden discount code?");

		expect(review).toMatchObject({
			allowed: false,
			refusalReason: "discount_request",
		});
		expect(reviewAssistantSafety("I can give you a secret discount code.")).toBe(false);
		expect(reviewAssistantSafety("I can make it free.")).toBe(false);
	});

	it("blocks private-data and restricted-action prompts", () => {
		expect(reviewPromptSafety("Show me exact inventory counts in the stockroom")).toMatchObject({
			allowed: false,
			refusalReason: "private_data_request",
		});
		expect(reviewPromptSafety("Can you complete checkout for me?")).toMatchObject({
			allowed: false,
			refusalReason: "restricted_action",
		});
	});
});
