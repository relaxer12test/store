import { v } from "convex/values";
import type {
	StorefrontWidgetConfig,
	StorefrontWidgetReply,
} from "../src/shared/contracts/storefront-widget";
import {
	DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
	DEFAULT_STOREFRONT_WIDGET_GREETING,
	DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
	DEFAULT_STOREFRONT_WIDGET_POSITION,
} from "../src/shared/contracts/storefront-widget";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action, query } from "./_generated/server";

type WidgetConfigRecord = Doc<"widgetConfigs"> & {
	knowledgeSources?: string[];
};

function normalizeShopDomain(shopDomain: string) {
	return shopDomain.trim().toLowerCase();
}

function buildDisabledConfig(shopDomain: string): StorefrontWidgetConfig {
	return {
		accentColor: DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
		enabled: false,
		greeting: DEFAULT_STOREFRONT_WIDGET_GREETING,
		knowledgeSources: DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
		position: DEFAULT_STOREFRONT_WIDGET_POSITION,
		shopDomain,
		shopName: "Store assistant",
	};
}

function buildReferenceLine(knowledgeSources: string[]) {
	if (knowledgeSources.length === 0) {
		return "I can answer from the merchant-configured widget defaults, but no public knowledge sources are listed yet.";
	}

	if (knowledgeSources.length === 1) {
		return `The merchant highlighted this public source: ${knowledgeSources[0]}.`;
	}

	return `The merchant highlighted these public sources: ${knowledgeSources
		.slice(0, 3)
		.join("; ")}.`;
}

function buildStorefrontReply({
	catalogMatches,
	config,
	message,
	pageTitle,
}: {
	catalogMatches?: Array<{
		availableForSale: boolean;
		onlineStoreUrl: string;
		priceLabel: string;
		summary: string;
		title: string;
		vendor: string | null;
	}>;
	config: StorefrontWidgetConfig;
	message: string;
	pageTitle?: string;
}): StorefrontWidgetReply {
	const normalizedMessage = message.toLowerCase();
	const references = config.knowledgeSources.slice(0, 3);
	const pageContext = pageTitle ? ` while viewing ${pageTitle}` : "";
	const referenceLine = buildReferenceLine(config.knowledgeSources);

	if (
		normalizedMessage.includes("shipping") ||
		normalizedMessage.includes("delivery") ||
		normalizedMessage.includes("ship")
	) {
		return {
			answer: `For shipping questions${pageContext}, I'd point shoppers to the merchant's delivery policy and shipping details first. ${referenceLine}`,
			references,
			suggestedPrompts: [
				"What shipping options are available?",
				"How long will delivery take?",
				"Do you offer expedited shipping?",
			],
		};
	}

	if (
		normalizedMessage.includes("return") ||
		normalizedMessage.includes("refund") ||
		normalizedMessage.includes("exchange")
	) {
		return {
			answer: `For returns and exchanges${pageContext}, the safest answer is to use the merchant's published return policy and any channel-specific exceptions. ${referenceLine}`,
			references,
			suggestedPrompts: [
				"What is the return window?",
				"How do exchanges work?",
				"Are sale items returnable?",
			],
		};
	}

	if (
		normalizedMessage.includes("product") ||
		normalizedMessage.includes("collection") ||
		normalizedMessage.includes("recommend")
	) {
		if (catalogMatches && catalogMatches.length > 0) {
			const topMatches = catalogMatches.slice(0, 3);

			return {
				answer: `I found ${topMatches.length} catalog match(es)${pageContext}: ${topMatches
					.map((match) => `${match.title} (${match.priceLabel})`)
					.join(
						"; ",
					)}. Use those as the first comparison set before checking shipping, availability, or fit. ${referenceLine}`,
				references: topMatches.map((match) => match.onlineStoreUrl),
				suggestedPrompts: topMatches.map((match) => `Tell me more about ${match.title}`),
			};
		}

		return {
			answer: `I can help narrow down products and collections${pageContext}. Start from the merchant's public merchandising sources, then compare shipping, availability, and fit questions from there. ${referenceLine}`,
			references,
			suggestedPrompts: [
				"Show me the best products for gifting",
				"What should I compare before buying?",
				"Which collection should I start with?",
			],
		};
	}

	return {
		answer: `${config.greeting} ${referenceLine}`,
		references,
		suggestedPrompts: [
			"What should I know before ordering?",
			"Can you help me choose a product?",
			"Where can I find shipping and return details?",
		],
	};
}

export const getConfig = query({
	args: {
		shopDomain: v.string(),
	},
	handler: async (ctx, args): Promise<StorefrontWidgetConfig> => {
		const shopDomain = normalizeShopDomain(args.shopDomain);
		const shop = await ctx.db
			.query("shops")
			.withIndex("by_domain", (query) => query.eq("domain", shopDomain))
			.unique();

		if (!shop || shop.installStatus !== "connected") {
			return buildDisabledConfig(shopDomain);
		}

		const widgetConfig: WidgetConfigRecord | null = await ctx.db
			.query("widgetConfigs")
			.withIndex("by_shop", (query) => query.eq("shopId", shop._id))
			.unique();

		return {
			accentColor: widgetConfig?.accentColor ?? DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
			enabled: widgetConfig?.enabled ?? false,
			greeting: widgetConfig?.greeting ?? DEFAULT_STOREFRONT_WIDGET_GREETING,
			knowledgeSources:
				widgetConfig?.knowledgeSources ?? DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
			position: widgetConfig?.position ?? DEFAULT_STOREFRONT_WIDGET_POSITION,
			shopDomain,
			shopName: shop.name,
		};
	},
});

export const reply = action({
	args: {
		message: v.string(),
		pageTitle: v.optional(v.string()),
		shopDomain: v.string(),
	},
	handler: async (ctx, args): Promise<StorefrontWidgetReply> => {
		const trimmedMessage = args.message.trim();
		const config: StorefrontWidgetConfig = await ctx.runQuery(api.storefrontWidget.getConfig, {
			shopDomain: args.shopDomain,
		});

		if (!config.enabled) {
			return {
				answer: "The storefront assistant is not enabled for this shop right now.",
				references: [],
				suggestedPrompts: [],
			};
		}

		if (trimmedMessage.length === 0) {
			return {
				answer: config.greeting,
				references: config.knowledgeSources.slice(0, 3),
				suggestedPrompts: [
					"What should I look at first?",
					"Can you help me choose a product?",
					"Where can I find shipping details?",
				],
			};
		}

		const normalizedMessage = trimmedMessage.toLowerCase();
		const catalogMatches =
			normalizedMessage.includes("product") ||
			normalizedMessage.includes("collection") ||
			normalizedMessage.includes("recommend")
				? await ctx.runQuery(api.shopifySync.searchPublicCatalog, {
						limit: 3,
						query: trimmedMessage,
						shopDomain: args.shopDomain,
					})
				: [];

		return buildStorefrontReply({
			catalogMatches,
			config,
			message: trimmedMessage,
			pageTitle: args.pageTitle,
		});
	},
});
