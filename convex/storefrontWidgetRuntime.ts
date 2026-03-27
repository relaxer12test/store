import { createOpenAI } from "@ai-sdk/openai";
import { Agent, createTool, stepCountIs } from "@convex-dev/agent";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components, internal } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ActionCtx } from "@convex/_generated/server";
import type { ToolSet } from "ai";
import { z } from "zod";
import type {
	CartPlan,
	StorefrontCollectionCard,
	StorefrontProductCard,
	StorefrontReference,
	StorefrontWidgetConfig,
	StorefrontWidgetPageContext,
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

type StreamEvent =
	| { event: "chunk"; data: { delta: string } }
	| { event: "done"; data: StorefrontWidgetReply }
	| { event: "error"; data: { message: string } }
	| { event: "meta"; data: { threadId: string } }
	| { event: "tool"; data: { toolName: string } };

type PreparedRequest = {
	clientFingerprint?: string;
	config: StorefrontWidgetConfig;
	effectiveSessionId: string;
	message: string;
	pageContext: StorefrontWidgetPageContext;
	pageTitle?: string;
	promptPreview: string;
	shopDomain: string;
	shopId: Id<"shops">;
	viewerUserId?: string;
};

type PolicyToolOutput = {
	answer: string;
	references: StorefrontReference[];
	suggestedPrompts: string[];
	topic: string;
};

type RuntimeRequest = {
	clientFingerprint?: string;
	message: string;
	pageContext: StorefrontWidgetPageContext;
	pageTitle?: string;
	sessionId?: string;
	shopDomain: string;
	viewerUserId?: string;
};

type StorefrontAgentCtx = ActionCtx & {
	clientFingerprint?: string;
	config: StorefrontWidgetConfig;
	pageContext: StorefrontWidgetPageContext;
	pageTitle?: string;
	shopId: Id<"shops">;
};

const storefrontReplyPlanSchema = z.object({
	collectionHandles: z.array(z.string().min(1).max(120)).max(6),
	includeCartPlan: z.boolean(),
	includeCheckoutLink: z.boolean(),
	productHandles: z.array(z.string().min(1).max(120)).max(6),
	refusalReason: z.string().min(1).max(200).nullable(),
	suggestedPrompts: z.array(z.string().min(1).max(120)).max(6),
	surface: z.enum(["none", "products", "collections", "cart", "checkout"]),
	tone: z.enum(["answer", "refusal"]),
	turnKind: z.enum([
		"social",
		"discovery",
		"collections",
		"policy",
		"compare",
		"bundle",
		"cart",
		"checkout",
		"refusal",
	]),
});

type StorefrontReplyPlan = z.infer<typeof storefrontReplyPlanSchema>;

type ToolOutputSnapshot = {
	cartPlan: CartPlan | null;
	collectionCards: StorefrontCollectionCard[];
	policyOutput: PolicyToolOutput | null;
	productCards: StorefrontProductCard[];
	replyPlan: StorefrontReplyPlan | null;
	toolNames: string[];
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

let storefrontAgentSingleton: Agent<StorefrontAgentCtx> | null = null;

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
		"gpt-5.4-mini"
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

function sanitizePageContext(
	pageContext: StorefrontWidgetPageContext | undefined,
): StorefrontWidgetPageContext {
	const canonicalUrl = trimOptionalText(pageContext?.canonicalUrl, 600);
	const collectionHandle = trimOptionalText(pageContext?.collectionHandle, 120);
	const collectionTitle = trimOptionalText(pageContext?.collectionTitle, 160);
	const pageType = trimOptionalText(pageContext?.pageType, 80) ?? "unknown";
	const productHandle = trimOptionalText(pageContext?.productHandle, 120);
	const productTitle = trimOptionalText(pageContext?.productTitle, 160);

	return {
		...(canonicalUrl ? { canonicalUrl } : {}),
		...(collectionHandle ? { collectionHandle } : {}),
		...(collectionTitle ? { collectionTitle } : {}),
		pageType,
		...(productHandle ? { productHandle } : {}),
		...(productTitle ? { productTitle } : {}),
	};
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

function toConfigReferences(config: StorefrontWidgetConfig) {
	return config.knowledgeSources.slice(0, 4).map((source) => ({
		label: source,
		url: /^https?:\/\//i.test(source) ? source : undefined,
	}));
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
			"I need to slow down for a moment. Please wait a few minutes, then ask again and I can keep helping.",
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

function normalizeHandleList(handles: string[]) {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const handle of handles) {
		const value = handle.trim().toLowerCase();

		if (!value || seen.has(value)) {
			continue;
		}

		seen.add(value);
		normalized.push(value);
	}

	return normalized;
}

function normalizeSuggestedPrompts(suggestedPrompts: string[], fallbackPrompts: string[]) {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const prompt of [...suggestedPrompts, ...fallbackPrompts]) {
		const value = prompt.trim();

		if (!value || seen.has(value)) {
			continue;
		}

		seen.add(value);
		normalized.push(value);
	}

	return normalized.slice(0, 6);
}

function toCardReferences(cards: Array<StorefrontProductCard | StorefrontCollectionCard>) {
	return cards.slice(0, 6).map((card) => ({
		label: card.title,
		url: card.href,
	}));
}

function buildCheckoutReference(config: StorefrontWidgetConfig) {
	return {
		label: "Go to checkout",
		url: `https://${config.shopDomain}/checkout`,
	} satisfies StorefrontReference;
}

function buildAgentUserId(prepared: PreparedRequest) {
	if (prepared.viewerUserId) {
		return `viewer:${prepared.shopId}:${prepared.viewerUserId}`;
	}

	return `session:${prepared.shopId}:${prepared.effectiveSessionId}`;
}

function buildSystemInstructions(config: StorefrontWidgetConfig) {
	return [
		"You are the public storefront AI concierge for a Shopify storefront.",
		`The store is ${config.shopName} (${config.shopDomain}).`,
		"Reply naturally to the shopper in warm, concise language.",
		"Use the tools before making claims about products, collections, variants, availability, or store policies.",
		"Treat greetings, acknowledgements, thanks, and farewells as social turns. Social turns should not surface products or collections.",
		"Use the explicit page context provided in the prompt when the shopper refers to the current page, product, or collection.",
		"Never offer discounts, coupons, price overrides, hidden deals, unpublished products, merchant-private data, exact inventory counts, or operational/admin actions.",
		"Before you finish every shopper turn, call emitReplyPlan exactly once.",
		"emitReplyPlan must describe the UI surface for this turn using exact product or collection handles when relevant.",
		"Use surface none for purely conversational turns.",
		"If the shopper is asking about shopping, comparison, collections, bundles, cart help, or checkout, choose the appropriate surface.",
		"If you refuse, keep it brief and redirect back to safe storefront help.",
		`Starter follow-up ideas the merchant prefers: ${config.quickPrompts.join(" | ")}.`,
	].join(" ");
}

function buildTools(toolCtx: StorefrontAgentCtx) {
	return {
		answerPolicyQuestion: createTool<
			{
				question: string;
			},
			PolicyToolOutput,
			StorefrontAgentCtx
		>({
			ctx: toolCtx,
			description:
				"Answer public shipping, returns, or contact questions using merchant-authored storefront-safe policy text.",
			execute: async (ctx, input) => {
				return await ctx.runQuery(internal.storefrontConcierge.answerPolicyQuestion, {
					question: input.question,
					shopId: ctx.shopId,
				});
			},
			inputSchema: z.object({
				question: z
					.string()
					.min(1)
					.max(300)
					.describe("The shopper's policy question in plain language."),
			}),
			strict: true,
		}),
		buildCartPlan: createTool<
			{
				explanation?: string;
				handles: string[];
				note?: string;
			},
			CartPlan | null,
			StorefrontAgentCtx
		>({
			ctx: toolCtx,
			description:
				"Build a storefront-safe cart plan from exact public product handles. This never changes price or discounts.",
			execute: async (ctx, input) => {
				return await ctx.runQuery(internal.storefrontConcierge.buildCartPlan, {
					explanation: input.explanation,
					handles: input.handles,
					note: input.note,
					shopId: ctx.shopId,
				});
			},
			inputSchema: z.object({
				explanation: z.string().min(1).max(320).optional(),
				handles: z.array(z.string().min(1).max(120)).min(1).max(4),
				note: z.string().min(1).max(200).optional(),
			}),
			strict: true,
		}),
		compareProducts: createTool<
			{
				handles: string[];
			},
			StorefrontProductCard[],
			StorefrontAgentCtx
		>({
			ctx: toolCtx,
			description: "Compare a few public products by exact product handles.",
			execute: async (ctx, input) => {
				return await ctx.runQuery(internal.storefrontConcierge.compareProducts, {
					handles: input.handles,
					shopId: ctx.shopId,
				});
			},
			inputSchema: z.object({
				handles: z.array(z.string().min(1).max(120)).min(1).max(3),
			}),
			strict: true,
		}),
		emitReplyPlan: createTool<StorefrontReplyPlan, StorefrontReplyPlan, StorefrontAgentCtx>({
			ctx: toolCtx,
			description:
				"Record the shopper-facing UI plan for this turn. Call exactly once before finishing each response.",
			execute: async (_ctx, input) => {
				return input;
			},
			inputSchema: storefrontReplyPlanSchema,
			strict: true,
		}),
		getCollectionDetail: createTool<
			{
				handle: string;
			},
			StorefrontCollectionCard | null,
			StorefrontAgentCtx
		>({
			ctx: toolCtx,
			description: "Get a single public collection by exact handle.",
			execute: async (ctx, input) => {
				return await ctx.runQuery(internal.storefrontConcierge.getCollectionDetail, {
					handle: input.handle,
					shopId: ctx.shopId,
				});
			},
			inputSchema: z.object({
				handle: z.string().min(1).max(120),
			}),
			strict: true,
		}),
		getProductDetail: createTool<
			{
				handle: string;
			},
			StorefrontProductCard | null,
			StorefrontAgentCtx
		>({
			ctx: toolCtx,
			description: "Get a single public product by exact handle.",
			execute: async (ctx, input) => {
				return await ctx.runQuery(internal.storefrontConcierge.getProductDetail, {
					handle: input.handle,
					shopId: ctx.shopId,
				});
			},
			inputSchema: z.object({
				handle: z.string().min(1).max(120),
			}),
			strict: true,
		}),
		recommendBundle: createTool<
			{
				query?: string;
			},
			StorefrontProductCard[],
			StorefrontAgentCtx
		>({
			ctx: toolCtx,
			description:
				"Recommend a safe starter bundle or complementary products using public storefront catalog data.",
			execute: async (ctx, input) => {
				return await ctx.runQuery(internal.storefrontConcierge.recommendBundle, {
					anchorHandle: ctx.pageContext.productHandle,
					query: input.query ?? "",
					shopId: ctx.shopId,
				});
			},
			inputSchema: z.object({
				query: z
					.string()
					.min(2)
					.max(200)
					.optional()
					.describe("Optional search phrase when bundling around a category or use case."),
			}),
			strict: true,
		}),
		searchCatalog: createTool<
			{
				limit?: number;
				query: string;
			},
			StorefrontProductCard[],
			StorefrontAgentCtx
		>({
			ctx: toolCtx,
			description:
				"Search the shop's public product catalog with a real shopper query. Do not use this for greetings or empty browsing.",
			execute: async (ctx, input) => {
				return await ctx.runQuery(internal.storefrontConcierge.searchCatalog, {
					limit: input.limit,
					query: input.query,
					shopId: ctx.shopId,
				});
			},
			inputExamples: [
				{ input: { query: "gift set" } },
				{ input: { limit: 3, query: "running shoe" } },
			],
			inputSchema: z.object({
				limit: z.number().int().min(1).max(6).optional(),
				query: z
					.string()
					.min(2)
					.max(200)
					.describe("The real product search phrase from the shopper."),
			}),
			strict: true,
		}),
		searchCollections: createTool<
			{
				limit?: number;
				query: string;
			},
			StorefrontCollectionCard[],
			StorefrontAgentCtx
		>({
			ctx: toolCtx,
			description: "Search the shop's public collections with a real shopper query.",
			execute: async (ctx, input) => {
				return await ctx.runQuery(internal.storefrontConcierge.searchCollections, {
					limit: input.limit,
					query: input.query,
					shopId: ctx.shopId,
				});
			},
			inputSchema: z.object({
				limit: z.number().int().min(1).max(6).optional(),
				query: z
					.string()
					.min(2)
					.max(200)
					.describe("The real collection search phrase from the shopper."),
			}),
			strict: true,
		}),
	} satisfies ToolSet;
}

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
			languageModel: openai.responses(getStorefrontModelId()),
			name: "storefront_concierge",
			stopWhen: stepCountIs(6),
		});
	}

	return storefrontAgentSingleton;
}

export function reviewPromptSafety(message: string) {
	const normalized = message.toLowerCase();

	if (
		/\b(free|secret discount|discount code|promo code|coupon|price override|override the price|hidden discount)\b/i.test(
			normalized,
		)
	) {
		return {
			allowed: false as const,
			category: "discount_request",
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
			category: "policy_bypass",
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
			category: "private_data_request",
			refusalReason: "private_data_request" as const,
		};
	}

	if (
		/\b(payment|refund an order|cancel an order|log me in|change my address|account action|complete checkout|checkout for me|complete purchase)\b/i.test(
			normalized,
		)
	) {
		return {
			allowed: false as const,
			category: "restricted_action",
			refusalReason: "restricted_action" as const,
		};
	}

	return {
		allowed: true as const,
		category: "conversation",
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

async function prepareRequest(
	ctx: ActionCtx,
	request: RuntimeRequest,
): Promise<
	| { immediateReply: StorefrontWidgetReply; prepared?: PreparedRequest }
	| { prepared: PreparedRequest }
> {
	const message = request.message.trim();
	const pageContext = sanitizePageContext(request.pageContext);
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
						pageContext,
						pageTitle,
						promptPreview: sanitizePromptPreview(message || "widget disabled"),
						shopDomain,
						shopId: context.shopId,
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
				pageContext,
				pageTitle,
				promptPreview: "greeting",
				shopDomain,
				shopId: context.shopId,
				viewerUserId: request.viewerUserId,
			},
		};
	}

	return {
		prepared: {
			clientFingerprint,
			config,
			effectiveSessionId: sessionId,
			message,
			pageContext,
			pageTitle,
			promptPreview: sanitizePromptPreview(message),
			shopDomain,
			shopId: context.shopId,
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

async function isValidAgentThread(ctx: ActionCtx, threadId: string) {
	try {
		const thread = await ctx.runQuery(components.agent.threads.getThread, {
			threadId,
		});

		return Boolean(thread);
	} catch {
		return false;
	}
}

async function ensureThreadState(ctx: ActionCtx, prepared: PreparedRequest) {
	const existingSession: {
		lastReply: StorefrontWidgetReply | null;
		lastReplyAt: number | null;
		lastReplyOrder: number | null;
		openaiConversationId: string | null;
		threadId: string;
	} | null = await ctx.runQuery(internal.storefrontConcierge.getSessionState, {
		sessionId: prepared.effectiveSessionId,
		shopId: prepared.shopId,
	});
	const agentCtx = {
		...ctx,
		clientFingerprint: prepared.clientFingerprint,
		config: prepared.config,
		pageContext: prepared.pageContext,
		pageTitle: prepared.pageTitle,
		shopId: prepared.shopId,
	} satisfies StorefrontAgentCtx;
	let threadId =
		existingSession?.threadId && (await isValidAgentThread(ctx, existingSession.threadId))
			? existingSession.threadId
			: null;

	if (!threadId) {
		const created = await getStorefrontAgent().createThread(agentCtx, {
			title: `Storefront concierge ${prepared.shopDomain}`,
			userId: buildAgentUserId(prepared),
		});
		threadId = created.threadId;
	}

	await ctx.runMutation(internal.storefrontConcierge.upsertSessionThread, {
		clientFingerprint: prepared.clientFingerprint,
		lastPromptPreview: prepared.promptPreview,
		openaiConversationId: existingSession?.openaiConversationId ?? undefined,
		sessionId: prepared.effectiveSessionId,
		shopId: prepared.shopId,
		threadId,
		viewerUserId: prepared.viewerUserId,
	});

	return {
		agentCtx,
		threadId,
	};
}

function extractToolOutputs(
	toolResults: Array<{ output: unknown; toolName: string }>,
): ToolOutputSnapshot {
	const productCards: StorefrontProductCard[] = [];
	const collectionCards: StorefrontCollectionCard[] = [];
	let cartPlan: CartPlan | null = null;
	let policyOutput: PolicyToolOutput | null = null;
	let replyPlan: StorefrontReplyPlan | null = null;
	const toolNames: string[] = [];

	for (const toolResult of toolResults) {
		if (toolResult.toolName !== "emitReplyPlan") {
			toolNames.push(toolResult.toolName);
		}

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

		if (toolResult.toolName === "getCollectionDetail" && toolResult.output) {
			collectionCards.push(toolResult.output as StorefrontCollectionCard);
			continue;
		}

		if (toolResult.toolName === "answerPolicyQuestion" && toolResult.output) {
			policyOutput = toolResult.output as PolicyToolOutput;
			continue;
		}

		if (toolResult.toolName === "buildCartPlan") {
			cartPlan = (toolResult.output as CartPlan | null) ?? null;
			continue;
		}

		if (toolResult.toolName === "emitReplyPlan" && toolResult.output) {
			replyPlan = storefrontReplyPlanSchema.parse(toolResult.output);
		}
	}

	return {
		cartPlan,
		collectionCards: dedupeByHandle(collectionCards).slice(0, 6),
		policyOutput,
		productCards: dedupeByHandle(productCards).slice(0, 6),
		replyPlan,
		toolNames: Array.from(new Set(toolNames)),
	};
}

async function resolveProductCards(
	ctx: ActionCtx,
	shopId: Id<"shops">,
	handles: string[],
	initialCards: StorefrontProductCard[],
) {
	const normalizedHandles = normalizeHandleList(handles).slice(0, 6);
	const byHandle = new Map(initialCards.map((card) => [card.handle, card]));
	const missingHandles = normalizedHandles.filter((handle) => !byHandle.has(handle));

	if (missingHandles.length > 0) {
		const missingCards = await Promise.all(
			missingHandles.map((handle) =>
				ctx.runQuery(internal.storefrontConcierge.getProductDetail, {
					handle,
					shopId,
				}),
			),
		);

		for (const card of missingCards) {
			if (card) {
				byHandle.set(card.handle, card);
			}
		}
	}

	return normalizedHandles.flatMap((handle) => {
		const card = byHandle.get(handle);
		return card ? [card] : [];
	});
}

async function resolveCollectionCards(
	ctx: ActionCtx,
	shopId: Id<"shops">,
	handles: string[],
	initialCards: StorefrontCollectionCard[],
) {
	const normalizedHandles = normalizeHandleList(handles).slice(0, 6);
	const byHandle = new Map(initialCards.map((card) => [card.handle, card]));
	const missingHandles = normalizedHandles.filter((handle) => !byHandle.has(handle));

	if (missingHandles.length > 0) {
		const missingCards = await Promise.all(
			missingHandles.map((handle) =>
				ctx.runQuery(internal.storefrontConcierge.getCollectionDetail, {
					handle,
					shopId,
				}),
			),
		);

		for (const card of missingCards) {
			if (card) {
				byHandle.set(card.handle, card);
			}
		}
	}

	return normalizedHandles.flatMap((handle) => {
		const card = byHandle.get(handle);
		return card ? [card] : [];
	});
}

async function buildReplyFromPlan(
	ctx: ActionCtx,
	prepared: PreparedRequest,
	answerText: string,
	outputs: ToolOutputSnapshot,
) {
	const replyPlan =
		outputs.replyPlan ??
		({
			collectionHandles: [],
			includeCartPlan: false,
			includeCheckoutLink: false,
			productHandles: [],
			refusalReason: null,
			suggestedPrompts: [],
			surface: "none",
			tone: "answer",
			turnKind: "social",
		} satisfies StorefrontReplyPlan);
	const productCards =
		replyPlan.surface === "products" ||
		replyPlan.surface === "cart" ||
		replyPlan.surface === "checkout"
			? await resolveProductCards(
					ctx,
					prepared.shopId,
					replyPlan.productHandles,
					outputs.productCards,
				)
			: [];
	const collectionCards =
		replyPlan.surface === "collections"
			? await resolveCollectionCards(
					ctx,
					prepared.shopId,
					replyPlan.collectionHandles,
					outputs.collectionCards,
				)
			: [];
	const cartPlan =
		(replyPlan.surface === "cart" || replyPlan.includeCartPlan) &&
		replyPlan.productHandles.length > 0
			? (outputs.cartPlan ??
				(await ctx.runQuery(internal.storefrontConcierge.buildCartPlan, {
					explanation: undefined,
					handles: replyPlan.productHandles.slice(0, 4),
					note: undefined,
					shopId: prepared.shopId,
				})))
			: null;
	const references = dedupeReferences([
		...(outputs.policyOutput?.references ?? []),
		...toCardReferences(productCards),
		...toCardReferences(collectionCards),
		...(replyPlan.includeCheckoutLink || replyPlan.surface === "checkout"
			? [buildCheckoutReference(prepared.config)]
			: []),
	]).slice(0, 6);
	const cards =
		replyPlan.tone === "refusal"
			? []
			: replyPlan.surface === "collections"
				? collectionCards
				: replyPlan.surface === "products" ||
					  replyPlan.surface === "cart" ||
					  replyPlan.surface === "checkout"
					? productCards
					: [];
	const fallbackPrompts =
		replyPlan.tone === "refusal" ? DEFAULT_SAFE_SUGGESTIONS : prepared.config.quickPrompts;
	const answer =
		answerText.trim() ||
		(replyPlan.tone === "refusal"
			? "I can't help with that, but I can still help with products, collections, or store policies."
			: "What can I help you find today?");
	const reply = storefrontWidgetReplySchema.parse({
		answer,
		cards,
		cartPlan: replyPlan.tone === "refusal" ? null : cartPlan,
		references,
		refusalReason: replyPlan.tone === "refusal" ? (replyPlan.refusalReason ?? "refusal") : null,
		suggestedPrompts: normalizeSuggestedPrompts(replyPlan.suggestedPrompts, fallbackPrompts),
		tone: replyPlan.tone,
	});

	if (!reviewAssistantSafety(reply.answer)) {
		return {
			outcome: "refusal" as const,
			promptCategory: "policy_bypass",
			reply: buildSafetyRefusalReply(prepared.config, "policy_bypass"),
			toolNames: outputs.toolNames,
		};
	}

	return {
		outcome: reply.tone === "refusal" ? ("refusal" as const) : ("answer" as const),
		promptCategory: replyPlan.turnKind,
		reply,
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
			const { agentCtx, threadId } = await ensureThreadState(ctx, prepared);

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

			const { thread } = await getStorefrontAgent().continueThread(agentCtx, {
				threadId,
				userId: buildAgentUserId(prepared),
			});
			const result = await thread.streamText(
				{
					prompt: prepared.message,
					system: buildSystemInstructions(prepared.config),
					tools: buildTools(agentCtx),
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
					storageOptions: {
						saveMessages: "all",
					},
				},
			);

			for await (const part of result.fullStream) {
				if (part.type === "text-delta") {
					send({
						data: {
							delta: part.text,
						},
						event: "chunk",
					});
					continue;
				}

				if (part.type === "tool-call" && part.toolName !== "emitReplyPlan") {
					send({
						data: {
							toolName: part.toolName,
						},
						event: "tool",
					});
				}
			}

			const answerText = await result.text;
			const steps = await result.steps;
			const outputs = extractToolOutputs(
				steps.flatMap((step) => step.toolResults) as Array<{
					output: unknown;
					toolName: string;
				}>,
			);
			const projected = await buildReplyFromPlan(ctx, prepared, answerText, outputs);

			await ctx.runMutation(internal.storefrontConcierge.saveSessionReply, {
				clientFingerprint: prepared.clientFingerprint,
				lastPromptPreview: prepared.promptPreview,
				openaiConversationId: undefined,
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
				promptCategory: projected.promptCategory,
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
				promptCategory: "generation_failed",
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
