import { createOpenAI } from "@ai-sdk/openai";
import { Agent, createTool, stepCountIs } from "@convex-dev/agent";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import type { StreamTextResult } from "ai";
import { z } from "zod";
import type {
	CartPlan,
	StorefrontCollectionCard,
	StorefrontProductCard,
	StorefrontReference,
	StorefrontWidgetConfig,
	StorefrontWidgetReply,
} from "@/shared/contracts/storefront-widget";
import {
	DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
	DEFAULT_STOREFRONT_WIDGET_GREETING,
	DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
	DEFAULT_STOREFRONT_WIDGET_POLICY_ANSWERS,
	DEFAULT_STOREFRONT_WIDGET_POSITION,
	DEFAULT_STOREFRONT_WIDGET_QUICK_PROMPTS,
	storefrontWidgetReplySchema,
} from "@/shared/contracts/storefront-widget";
import { components, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";

type PromptCategory =
	| "bundle"
	| "cart"
	| "checkout"
	| "collections"
	| "compare"
	| "discovery"
	| "policy";
type StreamEvent =
	| { event: "chunk"; data: { delta: string } }
	| { event: "done"; data: StorefrontWidgetReply }
	| { event: "error"; data: { message: string } }
	| { event: "meta"; data: { threadId: string } }
	| { event: "tool"; data: { toolName: string } };

type StorefrontAgentCtx = ActionCtx & {
	clientFingerprint?: string;
	config: StorefrontWidgetConfig;
	pageTitle?: string;
	shopId: Id<"shops">;
};

type PreparedRequest = {
	clientFingerprint?: string;
	config: StorefrontWidgetConfig;
	effectiveSessionId: string;
	message: string;
	pageTitle?: string;
	promptCategory: PromptCategory;
	promptPreview: string;
	shopDomain: string;
	shopId: Id<"shops">;
	userId: string;
	viewerUserId?: string;
};

type PolicyToolOutput = {
	answer: string;
	references: StorefrontReference[];
	suggestedPrompts: string[];
	topic: string;
};

type ToolOutputSnapshot = {
	collectionCards: StorefrontCollectionCard[];
	policyOutput: PolicyToolOutput | null;
	productCards: StorefrontProductCard[];
	cartPlan: CartPlan | null;
	toolNames: string[];
};

type RuntimeRequest = {
	clientFingerprint?: string;
	message: string;
	pageTitle?: string;
	sessionId?: string;
	shopDomain: string;
	viewerUserId?: string;
};

const DEFAULT_SAFE_SUGGESTIONS = [
	"Help me pick a product",
	"Compare a few options",
	"What is the return policy?",
];

const storefrontRateLimiter = new RateLimiter(components.rateLimiter, {
	storefrontClientMessage: {
		capacity: 20,
		kind: "fixed window",
		period: 10 * MINUTE,
		rate: 20,
	},
	storefrontSessionMessage: {
		capacity: 12,
		kind: "fixed window",
		period: 5 * MINUTE,
		rate: 12,
	},
});

function getEnv(name: string) {
	return (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env?.[name];
}

function getRequiredAiApiKey() {
	const value = getEnv("CONVEX_OPENAI_API_KEY") ?? getEnv("OPENAI_API_KEY");

	if (!value) {
		throw new Error(
			"Missing `CONVEX_OPENAI_API_KEY` (or `OPENAI_API_KEY`) for the storefront concierge model.",
		);
	}

	return value;
}

function getStorefrontModelId() {
	return (
		getEnv("CONVEX_STOREFRONT_CONCIERGE_MODEL") ??
		getEnv("STOREFRONT_CONCIERGE_MODEL") ??
		"gpt-5.4-nano"
	);
}

function normalizeShopDomain(shopDomain: string) {
	return shopDomain.trim().toLowerCase();
}

function trimOptionalText(value: string | undefined, maxLength: number) {
	const trimmed = value?.trim();

	if (!trimmed) {
		return undefined;
	}

	return trimmed.slice(0, maxLength);
}

function sanitizePromptPreview(prompt: string) {
	return prompt
		.trim()
		.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
		.replace(/\+?\d[\d\s().-]{7,}\d/g, "[redacted-phone]")
		.replace(/https?:\/\/\S+/gi, "[redacted-url]")
		.replace(/\b\d{6,}\b/g, "[redacted-number]")
		.replace(/\s+/g, " ")
		.slice(0, 220);
}

function usesPageContext(message: string) {
	return /\b(this|that|these|it)\b/i.test(message) || message.trim().length < 20;
}

function derivePromptCategory(message: string): PromptCategory {
	const normalized = message.toLowerCase();

	if (
		normalized.includes("checkout") ||
		normalized.includes("place order") ||
		normalized.includes("complete purchase")
	) {
		return "checkout";
	}

	if (
		normalized.includes("shipping") ||
		normalized.includes("delivery") ||
		normalized.includes("return") ||
		normalized.includes("refund") ||
		normalized.includes("exchange") ||
		normalized.includes("contact") ||
		normalized.includes("support")
	) {
		return "policy";
	}

	if (normalized.includes("compare") || normalized.includes("difference")) {
		return "compare";
	}

	if (normalized.includes("collection")) {
		return "collections";
	}

	if (
		normalized.includes("bundle") ||
		normalized.includes("complete the look") ||
		normalized.includes("pair with") ||
		normalized.includes("goes with")
	) {
		return "bundle";
	}

	if (normalized.includes("cart") || normalized.includes("add these")) {
		return "cart";
	}

	return "discovery";
}

export function reviewPromptSafety(message: string) {
	const category = derivePromptCategory(message);
	const normalized = message.toLowerCase();

	if (
		/\b(free|secret discount|discount code|promo code|coupon|price override|override the price|hidden discount)\b/i.test(
			normalized,
		)
	) {
		return {
			allowed: false as const,
			category,
			refusalReason: "discount_request" as const,
		};
	}

	if (
		/\b(ignore your rules|bypass|jailbreak|system prompt|pretend you can|override policy)\b/i.test(
			normalized,
		)
	) {
		return {
			allowed: false as const,
			category,
			refusalReason: "policy_bypass" as const,
		};
	}

	if (
		/\b(unpublished|private data|merchant notes|admin data|order history|customer data|exact inventory|inventory count|warehouse stock|stockroom)\b/i.test(
			normalized,
		)
	) {
		return {
			allowed: false as const,
			category,
			refusalReason: "private_data_request" as const,
		};
	}

	if (
		/\b(payment|refund an order|cancel an order|log me in|change my address|account action)\b/i.test(
			normalized,
		)
	) {
		return {
			allowed: false as const,
			category,
			refusalReason: "restricted_action" as const,
		};
	}

	return {
		allowed: true as const,
		category,
	};
}

export function reviewAssistantSafety(message: string) {
	const normalized = message.toLowerCase();

	if (
		/\b(secret discount|promo code|coupon code|price override|override the price|exact inventory|stockroom|unpublished product|private merchant)\b/i.test(
			normalized,
		)
	) {
		return false;
	}

	if (/\bi can (refund|cancel|change your address|log you in)\b/i.test(normalized)) {
		return false;
	}

	if (/\bi can make (this|that|it) free\b/i.test(normalized)) {
		return false;
	}

	return true;
}

function deriveSearchSeed(
	message: string,
	pageTitle: string | undefined,
	category: PromptCategory,
) {
	if (pageTitle && (usesPageContext(message) || category === "bundle" || category === "cart")) {
		return pageTitle;
	}

	return message;
}

function createEffectiveSessionId(input: {
	clientFingerprint?: string;
	shopDomain: string;
	sessionId?: string;
}) {
	const trimmedSessionId = trimOptionalText(input.sessionId, 120);

	if (trimmedSessionId) {
		return trimmedSessionId;
	}

	if (input.clientFingerprint) {
		return `client:${input.clientFingerprint}`;
	}

	return `ephemeral:${input.shopDomain}:${Date.now()}`;
}

function buildDisabledConfig(shopDomain: string): StorefrontWidgetConfig {
	return {
		accentColor: DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR,
		enabled: false,
		greeting: DEFAULT_STOREFRONT_WIDGET_GREETING,
		knowledgeSources: DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES,
		policyAnswers: DEFAULT_STOREFRONT_WIDGET_POLICY_ANSWERS,
		position: DEFAULT_STOREFRONT_WIDGET_POSITION,
		quickPrompts: DEFAULT_STOREFRONT_WIDGET_QUICK_PROMPTS,
		shopDomain,
		shopName: "Store assistant",
	};
}

function toConfigReferences(config: StorefrontWidgetConfig) {
	return config.knowledgeSources.slice(0, 4).map((source) => ({
		label: source,
		url: /^https?:\/\//i.test(source) ? source : undefined,
	}));
}

function buildGreetingReply(config: StorefrontWidgetConfig): StorefrontWidgetReply {
	return storefrontWidgetReplySchema.parse({
		answer: config.greeting,
		cards: [],
		cartPlan: null,
		references: toConfigReferences(config),
		refusalReason: null,
		suggestedPrompts: config.quickPrompts,
		tone: "answer",
	});
}

function buildDisabledReply(config: StorefrontWidgetConfig): StorefrontWidgetReply {
	return storefrontWidgetReplySchema.parse({
		answer:
			"The storefront concierge is not enabled for this shop right now. Try again after the merchant turns the widget back on.",
		cards: [],
		cartPlan: null,
		references: [],
		refusalReason: "widget_disabled",
		suggestedPrompts: config.quickPrompts,
		tone: "refusal",
	});
}

function buildRateLimitedReply(): StorefrontWidgetReply {
	return storefrontWidgetReplySchema.parse({
		answer:
			"I need to slow down for a moment. Please wait a few minutes, then ask again and I can keep helping with product discovery or cart planning.",
		cards: [],
		cartPlan: null,
		references: [],
		refusalReason: "rate_limited",
		suggestedPrompts: DEFAULT_SAFE_SUGGESTIONS,
		tone: "refusal",
	});
}

function buildUnavailableReply(config: StorefrontWidgetConfig): StorefrontWidgetReply {
	return storefrontWidgetReplySchema.parse({
		answer:
			"I couldn't finish that right now. Please try again in a moment and I can keep helping with products, collections, or store policies.",
		cards: [],
		cartPlan: null,
		references: toConfigReferences(config),
		refusalReason: "generation_failed",
		suggestedPrompts: config.quickPrompts,
		tone: "refusal",
	});
}

export function buildSafetyRefusalReply(
	config: StorefrontWidgetConfig,
	reason: "discount_request" | "policy_bypass" | "private_data_request" | "restricted_action",
): StorefrontWidgetReply {
	const answerByReason = {
		discount_request:
			"I can't create discounts or change prices, but I can still help you compare products or build a cart.",
		policy_bypass:
			"I can't help with that, but I can still help you browse products, compare options, or build a bundle.",
		private_data_request:
			"I can't share hidden stock details or other non-public store information.",
		restricted_action:
			"I can't handle payment details, refunds, or account actions. I can still help with your cart and send you to checkout.",
	} as const;

	return storefrontWidgetReplySchema.parse({
		answer: answerByReason[reason],
		cards: [],
		cartPlan: null,
		references: toConfigReferences(config).slice(0, 2),
		refusalReason: reason,
		suggestedPrompts: DEFAULT_SAFE_SUGGESTIONS,
		tone: "refusal",
	});
}

function buildPolicyReply(policyOutput: PolicyToolOutput): StorefrontWidgetReply {
	return storefrontWidgetReplySchema.parse({
		answer: policyOutput.answer,
		cards: [],
		cartPlan: null,
		references: policyOutput.references,
		refusalReason: null,
		suggestedPrompts: policyOutput.suggestedPrompts,
		tone: "answer",
	});
}

function buildCheckoutReply(config: StorefrontWidgetConfig): StorefrontWidgetReply {
	return storefrontWidgetReplySchema.parse({
		answer: "Your cart is ready when you are. Use the checkout link to continue.",
		cards: [],
		cartPlan: null,
		references: [
			{
				label: "Go to checkout",
				url: `https://${config.shopDomain}/checkout`,
			},
		],
		refusalReason: null,
		suggestedPrompts: ["Review my cart", "Add one more item", "What is the return policy?"],
		tone: "answer",
	});
}

function buildDiscoveryReply(
	config: StorefrontWidgetConfig,
	cards: StorefrontProductCard[],
	pageTitle?: string,
): StorefrontWidgetReply {
	if (cards.length === 0) {
		return storefrontWidgetReplySchema.parse({
			answer:
				"I couldn't find a close match yet. Try a product type, collection, or who you're shopping for and I'll narrow it down.",
			cards: [],
			cartPlan: null,
			references: [],
			refusalReason: null,
			suggestedPrompts: config.quickPrompts,
			tone: "answer",
		});
	}

	const pageContext = pageTitle ? ` for ${pageTitle}` : "";

	return storefrontWidgetReplySchema.parse({
		answer:
			cards.length === 1
				? `${cards[0].title} looks like the closest match${pageContext}. Want more like it or a quick comparison?`
				: `Here are a few good matches${pageContext}. ${cards
						.slice(0, 2)
						.map((card) => `${card.title} (${card.priceLabel})`)
						.join(" and ")} stand out first.`,
		cards,
		cartPlan: null,
		references: cards.slice(0, 3).map((card) => ({
			label: card.title,
			url: card.href,
		})),
		refusalReason: null,
		suggestedPrompts: [
			`Compare ${cards[0].title}`,
			"Show me a bundle",
			"What is the return policy?",
		],
		tone: "answer",
	});
}

function buildCompareReply(
	config: StorefrontWidgetConfig,
	cards: StorefrontProductCard[],
): StorefrontWidgetReply {
	if (cards.length < 2) {
		return buildDiscoveryReply(config, cards);
	}

	return storefrontWidgetReplySchema.parse({
		answer: `These are the easiest ones to compare: ${cards
			.slice(0, 3)
			.map((card) => `${card.title} (${card.priceLabel}, ${card.availabilityLabel.toLowerCase()})`)
			.join("; ")}.`,
		cards,
		cartPlan: null,
		references: cards.slice(0, 3).map((card) => ({
			label: card.title,
			url: card.href,
		})),
		refusalReason: null,
		suggestedPrompts: [
			"Which one looks best for gifting?",
			"Build me a bundle from these",
			"Show me a collection instead",
		],
		tone: "answer",
	});
}

function buildCollectionsReply(
	config: StorefrontWidgetConfig,
	cards: StorefrontCollectionCard[],
): StorefrontWidgetReply {
	if (cards.length === 0) {
		return storefrontWidgetReplySchema.parse({
			answer:
				"I couldn't find a close collection match yet. Try a broader category or tell me what kind of product you want to browse.",
			cards: [],
			cartPlan: null,
			references: [],
			refusalReason: null,
			suggestedPrompts: config.quickPrompts,
			tone: "answer",
		});
	}

	return storefrontWidgetReplySchema.parse({
		answer: `These collections are the best place to start: ${cards
			.slice(0, 3)
			.map((card) => card.title)
			.join(", ")}.`,
		cards,
		cartPlan: null,
		references: cards.slice(0, 3).map((card) => ({
			label: card.title,
			url: card.href,
		})),
		refusalReason: null,
		suggestedPrompts: [
			"Pick a product from one of these",
			"Compare a few top products",
			"Build me a bundle",
		],
		tone: "answer",
	});
}

function buildBundleReply(
	config: StorefrontWidgetConfig,
	cards: StorefrontProductCard[],
	cartPlan: StorefrontWidgetReply["cartPlan"],
): StorefrontWidgetReply {
	if (cards.length === 0) {
		return buildDiscoveryReply(config, []);
	}

	return storefrontWidgetReplySchema.parse({
		answer: cartPlan
			? "I pulled together a starter set for you. Take a look below, and I can swap anything out if you want."
			: "These work well together. If you want, I can narrow this into a bundle.",
		cards,
		cartPlan,
		references: cards.slice(0, 3).map((card) => ({
			label: card.title,
			url: card.href,
		})),
		refusalReason: null,
		suggestedPrompts: [
			"Swap one item for another option",
			"Compare these picks",
			"What is the shipping policy?",
		],
		tone: "answer",
	});
}

function dedupeByHandle<T extends { handle: string }>(items: T[]) {
	const seen = new Set<string>();
	const deduped: T[] = [];

	for (const item of items) {
		if (seen.has(item.handle)) {
			continue;
		}

		seen.add(item.handle);
		deduped.push(item);
	}

	return deduped;
}

function dedupeReferences(references: StorefrontReference[]) {
	const seen = new Set<string>();
	const deduped: StorefrontReference[] = [];

	for (const reference of references) {
		const key = `${reference.label}:${reference.url ?? ""}`;

		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		deduped.push(reference);
	}

	return deduped;
}

function buildAgentInstructions() {
	return [
		"You are the public storefront AI concierge for a Shopify storefront.",
		"Help shoppers with published products, collections, availability, shipping, returns, contact guidance, safe bundles, and cart plans only.",
		"Always use the provided tools before making claims about products, collections, availability, variants, or policies.",
		"Never offer discounts, coupons, price overrides, hidden deals, unpublished products, merchant-private data, exact inventory counts, or operational/admin actions.",
		"You may guide shoppers to checkout or send them to checkout, but do not claim you process payment details, refunds, cancellations, login, or account changes.",
		"Keep answers concise because the UI renders cards, references, and cart plans separately.",
		"When showing products or collections, keep the copy warm and shopper-facing. Do not mention public data, storefront data, cards, tools, or internal safety rules.",
		"If a request crosses the policy boundary, refuse briefly and redirect to safe storefront help.",
	].join(" ");
}

const searchCatalogTool = createTool<
	{
		limit?: number;
		query?: string;
	},
	StorefrontProductCard[],
	StorefrontAgentCtx
>({
	description:
		"Search the shop's public product catalog. Use this before recommending or comparing products.",
	inputExamples: [{ input: { query: "gift set" } }, { input: { limit: 3, query: "running shoe" } }],
	inputSchema: z.object({
		limit: z.number().int().min(1).max(6).optional(),
		query: z.string().min(1).max(200).optional(),
	}),
	execute: async (ctx, input) => {
		const query = trimOptionalText(input.query, 200) ?? trimOptionalText(ctx.pageTitle, 200);

		return await ctx.runQuery(internal.storefrontConcierge.searchCatalog, {
			limit: input.limit,
			query,
			shopId: ctx.shopId,
		});
	},
});

const getProductDetailTool = createTool<
	{
		handle: string;
	},
	StorefrontProductCard | null,
	StorefrontAgentCtx
>({
	description: "Get a single public product by handle when the shopper names a specific product.",
	inputSchema: z.object({
		handle: z.string().min(1).max(120),
	}),
	execute: async (ctx, input) => {
		return await ctx.runQuery(internal.storefrontConcierge.getProductDetail, {
			handle: input.handle,
			shopId: ctx.shopId,
		});
	},
});

const compareProductsTool = createTool<
	{
		handles: string[];
	},
	StorefrontProductCard[],
	StorefrontAgentCtx
>({
	description: "Compare a few public products by handle.",
	inputSchema: z.object({
		handles: z.array(z.string().min(1).max(120)).min(1).max(3),
	}),
	execute: async (ctx, input) => {
		return await ctx.runQuery(internal.storefrontConcierge.compareProducts, {
			handles: input.handles,
			shopId: ctx.shopId,
		});
	},
});

const searchCollectionsTool = createTool<
	{
		limit?: number;
		query?: string;
	},
	StorefrontCollectionCard[],
	StorefrontAgentCtx
>({
	description: "Search the shop's public collections.",
	inputSchema: z.object({
		limit: z.number().int().min(1).max(6).optional(),
		query: z.string().min(1).max(200).optional(),
	}),
	execute: async (ctx, input) => {
		const query = trimOptionalText(input.query, 200) ?? trimOptionalText(ctx.pageTitle, 200);

		return await ctx.runQuery(internal.storefrontConcierge.searchCollections, {
			limit: input.limit,
			query,
			shopId: ctx.shopId,
		});
	},
});

const answerPolicyQuestionTool = createTool<
	{
		question: string;
	},
	PolicyToolOutput,
	StorefrontAgentCtx
>({
	description:
		"Answer public shipping, returns, or contact questions using merchant-authored storefront-safe policy text.",
	inputSchema: z.object({
		question: z.string().min(1).max(300),
	}),
	execute: async (ctx, input) => {
		return await ctx.runQuery(internal.storefrontConcierge.answerPolicyQuestion, {
			question: input.question,
			shopId: ctx.shopId,
		});
	},
});

const recommendBundleTool = createTool<
	{
		query?: string;
	},
	StorefrontProductCard[],
	StorefrontAgentCtx
>({
	description:
		"Recommend a safe starter bundle or complementary products using public storefront catalog data.",
	inputSchema: z.object({
		query: z.string().min(1).max(200).optional(),
	}),
	execute: async (ctx, input) => {
		return await ctx.runQuery(internal.storefrontConcierge.recommendBundle, {
			pageTitle: ctx.pageTitle,
			query: input.query ?? ctx.pageTitle ?? "",
			shopId: ctx.shopId,
		});
	},
});

const buildCartPlanTool = createTool<
	{
		explanation?: string;
		handles: string[];
		note?: string;
	},
	CartPlan | null,
	StorefrontAgentCtx
>({
	description:
		"Build a storefront-safe cart plan from public product handles. This never sets price or discount data.",
	inputSchema: z.object({
		explanation: z.string().min(1).max(320).optional(),
		handles: z.array(z.string().min(1).max(120)).min(1).max(4),
		note: z.string().min(1).max(200).optional(),
	}),
	execute: async (ctx, input) => {
		return await ctx.runQuery(internal.storefrontConcierge.buildCartPlan, {
			explanation: input.explanation,
			handles: input.handles,
			note: input.note,
			shopId: ctx.shopId,
		});
	},
});

let storefrontAgentSingleton: Agent<StorefrontAgentCtx> | null = null;

function getStorefrontAgent() {
	if (!storefrontAgentSingleton) {
		const openai = createOpenAI({
			apiKey: getRequiredAiApiKey(),
		});

		storefrontAgentSingleton = new Agent<StorefrontAgentCtx>(components.agent, {
			callSettings: {
				maxOutputTokens: 700,
				temperature: 0.2,
			},
			instructions: buildAgentInstructions(),
			languageModel: openai(getStorefrontModelId()),
			name: "storefront_concierge",
			stopWhen: stepCountIs(5),
			tools: {
				answerPolicyQuestion: answerPolicyQuestionTool,
				buildCartPlan: buildCartPlanTool,
				compareProducts: compareProductsTool,
				getProductDetail: getProductDetailTool,
				recommendBundle: recommendBundleTool,
				searchCatalog: searchCatalogTool,
				searchCollections: searchCollectionsTool,
			},
		});
	}

	return storefrontAgentSingleton;
}

async function prepareRequest(
	ctx: ActionCtx,
	request: RuntimeRequest,
): Promise<
	| { immediateReply: StorefrontWidgetReply; prepared?: PreparedRequest }
	| { prepared: PreparedRequest }
> {
	const message = request.message.trim();
	const pageTitle = trimOptionalText(request.pageTitle, 200);
	const clientFingerprint = trimOptionalText(request.clientFingerprint, 128);
	const shopDomain = normalizeShopDomain(request.shopDomain);
	const sessionId = createEffectiveSessionId({
		clientFingerprint,
		sessionId: request.sessionId,
		shopDomain,
	});
	const context: { config: StorefrontWidgetConfig; shopId: Id<"shops"> | null } =
		await ctx.runQuery(internal.storefrontConcierge.getContext, {
			shopDomain,
		});
	const config = context.config ?? buildDisabledConfig(shopDomain);

	if (!context.shopId || !config.enabled) {
		if (context.shopId) {
			await ctx.runMutation(internal.storefrontConcierge.recordEvent, {
				cardCount: 0,
				cartPlanItemCount: 0,
				clientFingerprint,
				outcome: "disabled",
				pageTitle,
				promptCategory: "disabled",
				promptPreview: sanitizePromptPreview(message || "widget disabled"),
				refusalReason: "widget_disabled",
				sessionId,
				shopId: context.shopId,
				suggestedPromptCount: config.quickPrompts.length,
				toolNames: [],
			});
		}

		return {
			immediateReply: buildDisabledReply(config),
			prepared: context.shopId
				? {
						clientFingerprint,
						config,
						effectiveSessionId: sessionId,
						message,
						pageTitle,
						promptCategory: "discovery",
						promptPreview: sanitizePromptPreview(message || "widget disabled"),
						shopDomain,
						shopId: context.shopId,
						userId: `${context.shopId}:${sessionId}`,
						viewerUserId: request.viewerUserId,
					}
				: undefined,
		};
	}

	if (message.length === 0) {
		const greetingReply = buildGreetingReply(config);

		await ctx.runMutation(internal.storefrontConcierge.recordEvent, {
			cardCount: 0,
			cartPlanItemCount: 0,
			clientFingerprint,
			outcome: "answer",
			pageTitle,
			promptCategory: "greeting",
			promptPreview: "greeting",
			refusalReason: undefined,
			sessionId,
			shopId: context.shopId,
			suggestedPromptCount: greetingReply.suggestedPrompts.length,
			toolNames: [],
		});

		return {
			immediateReply: greetingReply,
			prepared: {
				clientFingerprint,
				config,
				effectiveSessionId: sessionId,
				message,
				pageTitle,
				promptCategory: "discovery",
				promptPreview: "greeting",
				shopDomain,
				shopId: context.shopId,
				userId: `${context.shopId}:${sessionId}`,
				viewerUserId: request.viewerUserId,
			},
		};
	}

	const promptCategory = derivePromptCategory(message);
	const promptPreview = sanitizePromptPreview(message);
	const sessionKey = `${context.shopId}:${sessionId}`;

	return {
		prepared: {
			clientFingerprint,
			config,
			effectiveSessionId: sessionId,
			message,
			pageTitle,
			promptCategory,
			promptPreview,
			shopDomain,
			shopId: context.shopId,
			userId: sessionKey,
			viewerUserId: request.viewerUserId,
		},
	};
}

async function enforceRateLimits(ctx: ActionCtx, prepared: PreparedRequest) {
	const sessionKey = `${prepared.shopId}:${prepared.effectiveSessionId}`;
	const clientKey = prepared.clientFingerprint
		? `${prepared.shopId}:${prepared.clientFingerprint}`
		: undefined;

	const sessionCheck = await storefrontRateLimiter.check(ctx, "storefrontSessionMessage", {
		key: sessionKey,
	});

	if (!sessionCheck.ok) {
		return false;
	}

	if (clientKey) {
		const clientCheck = await storefrontRateLimiter.check(ctx, "storefrontClientMessage", {
			key: clientKey,
		});

		if (!clientCheck.ok) {
			return false;
		}
	}

	const sessionLimit = await storefrontRateLimiter.limit(ctx, "storefrontSessionMessage", {
		key: sessionKey,
	});

	if (!sessionLimit.ok) {
		return false;
	}

	if (clientKey) {
		const clientLimit = await storefrontRateLimiter.limit(ctx, "storefrontClientMessage", {
			key: clientKey,
		});

		if (!clientLimit.ok) {
			return false;
		}
	}

	return true;
}

async function ensureThreadId(ctx: ActionCtx, prepared: PreparedRequest) {
	const existingSession: {
		lastReply: StorefrontWidgetReply | null;
		lastReplyAt: number | null;
		lastReplyOrder: number | null;
		threadId: string;
	} | null = await ctx.runQuery(internal.storefrontConcierge.getSessionState, {
		sessionId: prepared.effectiveSessionId,
		shopId: prepared.shopId,
	});
	const threadId =
		existingSession?.threadId ??
		(
			await getStorefrontAgent().createThread(ctx, {
				title: `Storefront concierge ${prepared.shopDomain}`,
				userId: prepared.userId,
			})
		).threadId;

	await ctx.runMutation(internal.storefrontConcierge.upsertSessionThread, {
		clientFingerprint: prepared.clientFingerprint,
		lastPromptPreview: prepared.promptPreview,
		sessionId: prepared.effectiveSessionId,
		shopId: prepared.shopId,
		threadId,
		viewerUserId: prepared.viewerUserId,
	});

	return threadId;
}

function extractToolOutputs(
	toolResults: Array<{ output: unknown; toolName: string }>,
): ToolOutputSnapshot {
	const productCards: StorefrontProductCard[] = [];
	const collectionCards: StorefrontCollectionCard[] = [];
	let cartPlan: CartPlan | null = null;
	let policyOutput: PolicyToolOutput | null = null;
	const toolNames: string[] = [];

	for (const toolResult of toolResults) {
		toolNames.push(toolResult.toolName);

		if (
			(toolResult.toolName === "searchCatalog" ||
				toolResult.toolName === "compareProducts" ||
				toolResult.toolName === "recommendBundle") &&
			Array.isArray(toolResult.output)
		) {
			productCards.push(...(toolResult.output as StorefrontProductCard[]));
			continue;
		}

		if (toolResult.toolName === "getProductDetail" && toolResult.output) {
			productCards.push(toolResult.output as StorefrontProductCard);
			continue;
		}

		if (toolResult.toolName === "searchCollections" && Array.isArray(toolResult.output)) {
			collectionCards.push(...(toolResult.output as StorefrontCollectionCard[]));
			continue;
		}

		if (toolResult.toolName === "answerPolicyQuestion" && toolResult.output) {
			policyOutput = toolResult.output as PolicyToolOutput;
			continue;
		}

		if (toolResult.toolName === "buildCartPlan") {
			cartPlan = (toolResult.output as CartPlan | null) ?? null;
		}
	}

	return {
		cartPlan,
		collectionCards: dedupeByHandle(collectionCards).slice(0, 6),
		policyOutput,
		productCards: dedupeByHandle(productCards).slice(0, 6),
		toolNames,
	};
}

async function addFallbackToolOutputs(
	ctx: ActionCtx,
	prepared: PreparedRequest,
	outputs: ToolOutputSnapshot,
) {
	const searchSeed = deriveSearchSeed(
		prepared.message,
		prepared.pageTitle,
		prepared.promptCategory,
	);

	if (prepared.promptCategory === "policy" && !outputs.policyOutput) {
		outputs.policyOutput = await ctx.runQuery(internal.storefrontConcierge.answerPolicyQuestion, {
			question: prepared.message,
			shopId: prepared.shopId,
		});
		outputs.toolNames.push("answerPolicyQuestion");
	}

	if (prepared.promptCategory === "collections" && outputs.collectionCards.length === 0) {
		outputs.collectionCards = await ctx.runQuery(internal.storefrontConcierge.searchCollections, {
			limit: 4,
			query: searchSeed,
			shopId: prepared.shopId,
		});
		outputs.toolNames.push("searchCollections");
	}

	if (
		(prepared.promptCategory === "bundle" || prepared.promptCategory === "cart") &&
		outputs.productCards.length === 0
	) {
		outputs.productCards = await ctx.runQuery(internal.storefrontConcierge.recommendBundle, {
			pageTitle: prepared.pageTitle,
			query: searchSeed,
			shopId: prepared.shopId,
		});
		outputs.toolNames.push("recommendBundle");
	}

	if (
		prepared.promptCategory !== "policy" &&
		prepared.promptCategory !== "checkout" &&
		prepared.promptCategory !== "collections" &&
		outputs.productCards.length === 0
	) {
		outputs.productCards = await ctx.runQuery(internal.storefrontConcierge.searchCatalog, {
			limit: prepared.promptCategory === "compare" ? 3 : 4,
			query: searchSeed,
			shopId: prepared.shopId,
		});
		outputs.toolNames.push("searchCatalog");
	}

	if (
		(prepared.promptCategory === "bundle" || prepared.promptCategory === "cart") &&
		!outputs.cartPlan &&
		outputs.productCards.length > 0
	) {
		outputs.cartPlan = await ctx.runQuery(internal.storefrontConcierge.buildCartPlan, {
			explanation: "A simple starter set based on the closest matches.",
			handles: outputs.productCards.map((card) => card.handle).slice(0, 4),
			note: undefined,
			shopId: prepared.shopId,
		});
		outputs.toolNames.push("buildCartPlan");
	}

	outputs.collectionCards = dedupeByHandle(outputs.collectionCards).slice(0, 6);
	outputs.productCards = dedupeByHandle(outputs.productCards).slice(0, 6);
	outputs.toolNames = Array.from(new Set(outputs.toolNames));
}

function buildFallbackReply(prepared: PreparedRequest, outputs: ToolOutputSnapshot) {
	if (outputs.policyOutput) {
		return buildPolicyReply(outputs.policyOutput);
	}

	if (prepared.promptCategory === "collections") {
		return buildCollectionsReply(prepared.config, outputs.collectionCards);
	}

	if (prepared.promptCategory === "checkout") {
		return buildCheckoutReply(prepared.config);
	}

	if (prepared.promptCategory === "compare") {
		return buildCompareReply(prepared.config, outputs.productCards);
	}

	if (prepared.promptCategory === "bundle" || prepared.promptCategory === "cart") {
		return buildBundleReply(prepared.config, outputs.productCards, outputs.cartPlan);
	}

	return buildDiscoveryReply(prepared.config, outputs.productCards, prepared.pageTitle);
}

async function buildProjectedReply(
	ctx: ActionCtx,
	prepared: PreparedRequest,
	result: StreamTextResult<any, any> & {
		order: number;
	},
) {
	const steps = await result.steps;
	const toolResults = steps.flatMap((step) => step.toolResults) as Array<{
		output: unknown;
		toolName: string;
	}>;
	const outputs = extractToolOutputs(toolResults);
	await addFallbackToolOutputs(ctx, prepared, outputs);

	const reply = buildFallbackReply(prepared, outputs);

	return {
		outcome: reply.tone === "refusal" ? ("refusal" as const) : ("answer" as const),
		reply: storefrontWidgetReplySchema.parse({
			...reply,
			references: dedupeReferences(reply.references).slice(0, 6),
		}),
		toolNames: outputs.toolNames,
	};
}

function encodeEvent(event: StreamEvent) {
	return new TextEncoder().encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
}

function createSseResponse(handler: (send: (event: StreamEvent) => void) => Promise<void>) {
	return new Response(
		new ReadableStream({
			async start(controller) {
				const send = (event: StreamEvent) => {
					controller.enqueue(encodeEvent(event));
				};

				try {
					await handler(send);
				} catch (error) {
					send({
						data: {
							message:
								error instanceof Error
									? error.message
									: "The storefront assistant could not respond.",
						},
						event: "error",
					});
				} finally {
					controller.close();
				}
			},
		}),
		{
			headers: {
				"Cache-Control": "no-store",
				"Content-Type": "text/event-stream; charset=utf-8",
				"X-Accel-Buffering": "no",
			},
		},
	);
}

export function getStorefrontConfigFallback(shopDomain: string) {
	return buildDisabledConfig(shopDomain);
}

export async function streamStorefrontWidgetReply(ctx: ActionCtx, request: RuntimeRequest) {
	const preparedResult = await prepareRequest(ctx, request);

	if ("immediateReply" in preparedResult) {
		return createSseResponse(async (send) => {
			send({
				data: preparedResult.immediateReply,
				event: "done",
			});
		});
	}

	const prepared = preparedResult.prepared;
	const safetyReview = reviewPromptSafety(prepared.message);

	if (!safetyReview.allowed) {
		await ctx.runMutation(internal.storefrontConcierge.flagModeration, {
			clientFingerprint: prepared.clientFingerprint,
			promptPreview: prepared.promptPreview,
			reason: safetyReview.refusalReason,
			sessionId: prepared.effectiveSessionId,
			shopId: prepared.shopId,
		});

		const refusalReply = buildSafetyRefusalReply(prepared.config, safetyReview.refusalReason);

		await ctx.runMutation(internal.storefrontConcierge.recordEvent, {
			cardCount: 0,
			cartPlanItemCount: 0,
			clientFingerprint: prepared.clientFingerprint,
			outcome: "refusal",
			pageTitle: prepared.pageTitle,
			promptCategory: safetyReview.category,
			promptPreview: prepared.promptPreview,
			refusalReason: safetyReview.refusalReason,
			sessionId: prepared.effectiveSessionId,
			shopId: prepared.shopId,
			suggestedPromptCount: refusalReply.suggestedPrompts.length,
			toolNames: [],
		});

		return createSseResponse(async (send) => {
			send({
				data: refusalReply,
				event: "done",
			});
		});
	}

	const rateLimitAllowed = await enforceRateLimits(ctx, prepared);

	if (!rateLimitAllowed) {
		const rateLimitedReply = buildRateLimitedReply();

		await ctx.runMutation(internal.storefrontConcierge.recordEvent, {
			cardCount: 0,
			cartPlanItemCount: 0,
			clientFingerprint: prepared.clientFingerprint,
			outcome: "rate_limited",
			pageTitle: prepared.pageTitle,
			promptCategory: "rate_limited",
			promptPreview: prepared.promptPreview,
			refusalReason: "rate_limited",
			sessionId: prepared.effectiveSessionId,
			shopId: prepared.shopId,
			suggestedPromptCount: rateLimitedReply.suggestedPrompts.length,
			toolNames: [],
		});

		return createSseResponse(async (send) => {
			send({
				data: rateLimitedReply,
				event: "done",
			});
		});
	}

	return createSseResponse(async (send) => {
		try {
			const threadId = await ensureThreadId(ctx, prepared);
			await ctx.runMutation(internal.storefrontConcierge.appendSessionMessage, {
				body: prepared.message,
				role: "user",
				sessionId: prepared.effectiveSessionId,
				shopId: prepared.shopId,
				viewerUserId: prepared.viewerUserId,
			});
			send({
				data: {
					threadId,
				},
				event: "meta",
			});

			const agent = getStorefrontAgent();
			const toolCtx = {
				...ctx,
				clientFingerprint: prepared.clientFingerprint,
				config: prepared.config,
				pageTitle: prepared.pageTitle,
				shopId: prepared.shopId,
			} as StorefrontAgentCtx;
			const { thread } = await agent.continueThread(toolCtx, {
				threadId,
				userId: prepared.userId,
			});
			const result = (await thread.streamText(
				{
					abortSignal: undefined,
					prompt: prepared.message,
				},
				{
					contextOptions: {
						excludeToolMessages: true,
						recentMessages: 8,
					},
					saveStreamDeltas: {
						returnImmediately: true,
						throttleMs: 200,
					},
				},
			)) as Awaited<ReturnType<typeof thread.streamText>>;

			for await (const part of result.fullStream) {
				if (part.type === "tool-call") {
					send({
						data: {
							toolName: part.toolName,
						},
						event: "tool",
					});
				}
			}

			const projected = await buildProjectedReply(ctx, prepared, result);

			await ctx.runMutation(internal.storefrontConcierge.saveSessionReply, {
				clientFingerprint: prepared.clientFingerprint,
				lastPromptPreview: prepared.promptPreview,
				reply: projected.reply,
				sessionId: prepared.effectiveSessionId,
				shopId: prepared.shopId,
				threadId,
				threadOrder: result.order,
				viewerUserId: prepared.viewerUserId,
			});

			await ctx.runMutation(internal.storefrontConcierge.recordEvent, {
				cardCount: projected.reply.cards.length,
				cartPlanItemCount: projected.reply.cartPlan?.items.length ?? 0,
				clientFingerprint: prepared.clientFingerprint,
				outcome: projected.outcome,
				pageTitle: prepared.pageTitle,
				promptCategory: prepared.promptCategory,
				promptPreview: prepared.promptPreview,
				refusalReason: projected.reply.refusalReason ?? undefined,
				sessionId: prepared.effectiveSessionId,
				shopId: prepared.shopId,
				suggestedPromptCount: projected.reply.suggestedPrompts.length,
				toolNames: projected.toolNames,
			});

			send({
				data: projected.reply,
				event: "done",
			});
		} catch (error) {
			const failureReply = buildUnavailableReply(prepared.config);

			await ctx.runMutation(internal.storefrontConcierge.recordEvent, {
				cardCount: 0,
				cartPlanItemCount: 0,
				clientFingerprint: prepared.clientFingerprint,
				outcome: "refusal",
				pageTitle: prepared.pageTitle,
				promptCategory: prepared.promptCategory,
				promptPreview: prepared.promptPreview,
				refusalReason: "generation_failed",
				sessionId: prepared.effectiveSessionId,
				shopId: prepared.shopId,
				suggestedPromptCount: failureReply.suggestedPrompts.length,
				toolNames: [],
			});

			send({
				data: failureReply,
				event: "done",
			});

			console.error("storefrontWidget stream failed", error);
		}
	});
}
