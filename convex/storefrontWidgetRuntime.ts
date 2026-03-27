import { createOpenAI } from "@ai-sdk/openai";
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components, internal } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ActionCtx } from "@convex/_generated/server";
import { generateText, Output } from "ai";
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

type ToolOutputSnapshot = {
	cartPlan: CartPlan | null;
	collectionCards: StorefrontCollectionCard[];
	policyOutput: PolicyToolOutput | null;
	productCards: StorefrontProductCard[];
	toolNames: string[];
};

const DEFAULT_SAFE_SUGGESTIONS = [
	"Help me pick a product",
	"Compare a few options",
	"What is the return policy?",
];

const OPENAI_CONVERSATIONS_URL = "https://api.openai.com/v1/conversations";

const storefrontTurnHintsSchema = z.object({
	answer: z.string().min(1).max(1200),
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

type StorefrontTurnHints = z.infer<typeof storefrontTurnHintsSchema>;

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

function buildLegacyThreadId(prepared: PreparedRequest) {
	return `storefront:${prepared.shopId}:${prepared.effectiveSessionId}`;
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
		}
	}

	return {
		cartPlan,
		collectionCards: dedupeByHandle(collectionCards).slice(0, 6),
		policyOutput,
		productCards: dedupeByHandle(productCards).slice(0, 6),
		toolNames: Array.from(new Set(toolNames)),
	};
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

function buildSystemInstructions(config: StorefrontWidgetConfig) {
	return [
		`You are the public storefront AI concierge for ${config.shopName} (${config.shopDomain}).`,
		"Your job is to respond naturally to shoppers and decide what storefront surface, if any, should appear.",
		"Treat greetings, thanks, acknowledgements, and farewells as social turns. For social turns, respond warmly, keep surface as none, and do not surface products or collections.",
		"Only surface products or collections when the shopper is actually asking for shopping help, browsing, comparison, bundling, cart help, or checkout.",
		"Never invent product, collection, policy, price, availability, or variant details. Use tools before making claims about catalog or policy facts.",
		"When the shopper refers to the current page or product, use the explicit page context provided in the current turn instead of display-title guesswork.",
		"Keep answers concise, natural, and shopper-facing. One to three sentences is usually enough.",
		"When you surface products or collections, include exact handles from the tool results in productHandles or collectionHandles.",
		"If you want the UI to show a cart plan, set includeCartPlan to true and provide productHandles for the items to include.",
		"If you want the UI to show checkout, set includeCheckoutLink to true.",
		"If you must refuse, keep the refusal short, safe, and redirect back to allowed storefront help.",
		`Example follow-up prompts the merchant likes: ${config.quickPrompts.join(" | ")}.`,
	].join(" ");
}

function buildUserTurnPrompt(prepared: PreparedRequest) {
	return JSON.stringify(
		{
			currentTurn: {
				pageContext: prepared.pageContext,
				pageTitle: prepared.pageTitle ?? null,
				shopDomain: prepared.shopDomain,
				shopName: prepared.config.shopName,
				userMessage: prepared.message,
			},
			storefrontRules: {
				publishedCatalogOnly: true,
				safeActionsOnly: true,
			},
		},
		null,
		2,
	);
}

function buildTools(ctx: ActionCtx, prepared: PreparedRequest) {
	return {
		answerPolicyQuestion: {
			description:
				"Answer public shipping, returns, or contact questions using merchant-authored storefront-safe policy text.",
			execute: async (input: { question: string }) => {
				return await ctx.runQuery(internal.storefrontConcierge.answerPolicyQuestion, {
					question: input.question,
					shopId: prepared.shopId,
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
		},
		buildCartPlan: {
			description:
				"Build a storefront-safe cart plan from exact public product handles. This never changes price or discounts.",
			execute: async (input: { explanation?: string; handles: string[]; note?: string }) => {
				return await ctx.runQuery(internal.storefrontConcierge.buildCartPlan, {
					explanation: input.explanation,
					handles: input.handles,
					note: input.note,
					shopId: prepared.shopId,
				});
			},
			inputSchema: z.object({
				explanation: z.string().min(1).max(320).optional(),
				handles: z.array(z.string().min(1).max(120)).min(1).max(4),
				note: z.string().min(1).max(200).optional(),
			}),
			strict: true,
		},
		compareProducts: {
			description: "Compare a few public products by exact product handles.",
			execute: async (input: { handles: string[] }) => {
				return await ctx.runQuery(internal.storefrontConcierge.compareProducts, {
					handles: input.handles,
					shopId: prepared.shopId,
				});
			},
			inputSchema: z.object({
				handles: z.array(z.string().min(1).max(120)).min(1).max(3),
			}),
			strict: true,
		},
		getCollectionDetail: {
			description: "Get a single public collection by exact handle.",
			execute: async (input: { handle: string }) => {
				return await ctx.runQuery(internal.storefrontConcierge.getCollectionDetail, {
					handle: input.handle,
					shopId: prepared.shopId,
				});
			},
			inputSchema: z.object({
				handle: z.string().min(1).max(120),
			}),
			strict: true,
		},
		getProductDetail: {
			description: "Get a single public product by exact handle.",
			execute: async (input: { handle: string }) => {
				return await ctx.runQuery(internal.storefrontConcierge.getProductDetail, {
					handle: input.handle,
					shopId: prepared.shopId,
				});
			},
			inputSchema: z.object({
				handle: z.string().min(1).max(120),
			}),
			strict: true,
		},
		recommendBundle: {
			description:
				"Recommend a safe starter bundle or complementary products using public storefront catalog data.",
			execute: async (input: { query?: string }) => {
				return await ctx.runQuery(internal.storefrontConcierge.recommendBundle, {
					anchorHandle: prepared.pageContext.productHandle,
					query: input.query ?? "",
					shopId: prepared.shopId,
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
		},
		searchCatalog: {
			description:
				"Search the shop's public product catalog with a real shopper query. Do not use this for generic greetings.",
			execute: async (input: { limit?: number; query: string }) => {
				return await ctx.runQuery(internal.storefrontConcierge.searchCatalog, {
					limit: input.limit,
					query: input.query,
					shopId: prepared.shopId,
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
		},
		searchCollections: {
			description: "Search the shop's public collections with a real shopper query.",
			execute: async (input: { limit?: number; query: string }) => {
				return await ctx.runQuery(internal.storefrontConcierge.searchCollections, {
					limit: input.limit,
					query: input.query,
					shopId: prepared.shopId,
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
		},
	} as const;
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
	const context: {
		config: StorefrontWidgetConfig;
		shopId: Id<"shops"> | null;
	} = await ctx.runQuery(internal.storefrontConcierge.getContext, {
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

async function createOpenAIConversationId() {
	const response = await fetch(OPENAI_CONVERSATIONS_URL, {
		body: "{}",
		headers: {
			Authorization: `Bearer ${getRequiredAiApiKey()}`,
			"Content-Type": "application/json",
		},
		method: "POST",
	});

	if (!response.ok) {
		throw new Error("OpenAI conversation creation failed.");
	}

	const payload = (await response.json()) as {
		id?: unknown;
	};

	if (typeof payload.id !== "string" || payload.id.length === 0) {
		throw new Error("OpenAI conversation creation returned no conversation id.");
	}

	return payload.id;
}

async function ensureSessionRuntimeState(ctx: ActionCtx, prepared: PreparedRequest) {
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
	const openaiConversationId =
		existingSession?.openaiConversationId ?? (await createOpenAIConversationId());
	const threadId = existingSession?.threadId ?? buildLegacyThreadId(prepared);
	const threadOrder =
		typeof existingSession?.lastReplyOrder === "number" ? existingSession.lastReplyOrder + 1 : 1;

	await ctx.runMutation(internal.storefrontConcierge.upsertSessionThread, {
		clientFingerprint: prepared.clientFingerprint,
		lastPromptPreview: prepared.promptPreview,
		openaiConversationId,
		sessionId: prepared.effectiveSessionId,
		shopId: prepared.shopId,
		threadId,
		viewerUserId: prepared.viewerUserId,
	});

	return {
		openaiConversationId,
		threadId,
		threadOrder,
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

async function buildReplyFromTurnHints(
	ctx: ActionCtx,
	prepared: PreparedRequest,
	turnHints: StorefrontTurnHints,
	outputs: ToolOutputSnapshot,
) {
	const productHandles = normalizeHandleList([
		...turnHints.productHandles,
		...outputs.productCards.map((card) => card.handle),
	]);
	const collectionHandles = normalizeHandleList([
		...turnHints.collectionHandles,
		...outputs.collectionCards.map((card) => card.handle),
	]);
	const productCards =
		turnHints.surface === "products" ||
		turnHints.surface === "cart" ||
		turnHints.surface === "checkout"
			? await resolveProductCards(ctx, prepared.shopId, productHandles, outputs.productCards)
			: [];
	const collectionCards =
		turnHints.surface === "collections"
			? await resolveCollectionCards(
					ctx,
					prepared.shopId,
					collectionHandles,
					outputs.collectionCards,
				)
			: [];
	const cartPlan =
		turnHints.includeCartPlan && productHandles.length > 0
			? (outputs.cartPlan ??
				(await ctx.runQuery(internal.storefrontConcierge.buildCartPlan, {
					explanation: undefined,
					handles: productHandles.slice(0, 4),
					note: undefined,
					shopId: prepared.shopId,
				})))
			: null;
	const references = dedupeReferences([
		...(outputs.policyOutput?.references ?? []),
		...toCardReferences(productCards),
		...toCardReferences(collectionCards),
		...(turnHints.includeCheckoutLink || turnHints.surface === "checkout"
			? [buildCheckoutReference(prepared.config)]
			: []),
	]).slice(0, 6);
	const cards =
		turnHints.tone === "refusal"
			? []
			: turnHints.surface === "collections"
				? collectionCards
				: turnHints.surface === "products" ||
					  turnHints.surface === "cart" ||
					  turnHints.surface === "checkout"
					? productCards
					: [];
	const fallbackPrompts =
		turnHints.tone === "refusal" ? DEFAULT_SAFE_SUGGESTIONS : prepared.config.quickPrompts;
	const reply = storefrontWidgetReplySchema.parse({
		answer: turnHints.answer.trim(),
		cards,
		cartPlan: turnHints.tone === "refusal" ? null : cartPlan,
		references,
		refusalReason: turnHints.tone === "refusal" ? (turnHints.refusalReason ?? "refusal") : null,
		suggestedPrompts: normalizeSuggestedPrompts(turnHints.suggestedPrompts, fallbackPrompts),
		tone: turnHints.tone,
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
		promptCategory: turnHints.turnKind,
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
			const sessionRuntimeState = await ensureSessionRuntimeState(ctx, prepared);
			await ctx.runMutation(internal.storefrontConcierge.appendSessionMessage, {
				body: prepared.message,
				role: "user",
				sessionId: prepared.effectiveSessionId,
				shopId: prepared.shopId,
				viewerUserId: prepared.viewerUserId,
			});

			send({
				data: {
					threadId: sessionRuntimeState.threadId,
				},
				event: "meta",
			});

			const openai = createOpenAI({
				apiKey: getRequiredAiApiKey(),
			});
			const result = await generateText({
				maxOutputTokens: 700,
				model: openai.responses(getStorefrontModelId()),
				output: Output.object({
					description:
						"Structured storefront response hints for conversational behavior and UI surfaces.",
					name: "storefront_turn_hints",
					schema: storefrontTurnHintsSchema,
				}),
				providerOptions: {
					openai: {
						conversation: sessionRuntimeState.openaiConversationId,
						reasoningEffort: "low",
					},
				},
				prompt: buildUserTurnPrompt(prepared),
				system: buildSystemInstructions(prepared.config),
				tools: buildTools(ctx, prepared),
			});
			const toolResults = result.steps.flatMap((step) => step.toolResults) as Array<{
				output: unknown;
				toolName: string;
			}>;
			const outputs = extractToolOutputs(toolResults);
			const projected = await buildReplyFromTurnHints(ctx, prepared, result.output, outputs);

			await ctx.runMutation(internal.storefrontConcierge.saveSessionReply, {
				clientFingerprint: prepared.clientFingerprint,
				lastPromptPreview: prepared.promptPreview,
				openaiConversationId: sessionRuntimeState.openaiConversationId,
				reply: projected.reply,
				sessionId: prepared.effectiveSessionId,
				shopId: prepared.shopId,
				threadId: sessionRuntimeState.threadId,
				threadOrder: sessionRuntimeState.threadOrder,
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
