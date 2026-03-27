import { z } from "zod";

export type WidgetPosition = "bottom-right" | "bottom-left";
export type StorefrontReplyTone = "answer" | "refusal";

export interface StorefrontPolicyAnswers {
	contact: string;
	returns: string;
	shipping: string;
}

export interface StorefrontReference {
	label: string;
	url?: string;
}

export interface StorefrontProductCard {
	availabilityLabel: string;
	handle: string;
	href: string;
	imageUrl?: string;
	kind: "product";
	priceLabel: string;
	summary: string;
	title: string;
	vendor: string | null;
}

export interface StorefrontCollectionCard {
	handle: string;
	href: string;
	kind: "collection";
	productCount: number | null;
	summary: string;
	title: string;
}

export type StorefrontWidgetCard = StorefrontProductCard | StorefrontCollectionCard;

export interface CartPlanItem {
	productHandle: string;
	productTitle: string;
	productUrl: string;
	quantity: number;
	variantId: string;
	variantTitle: string;
}

export interface CartPlan {
	explanation?: string;
	items: CartPlanItem[];
	note?: string;
}

export const DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR = "#0f172a";
export const DEFAULT_STOREFRONT_WIDGET_GREETING =
	"Ask about products, collections, shipping policies, or what I can help you add to cart.";
export const DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES: string[] = [];
export const DEFAULT_STOREFRONT_WIDGET_POSITION: WidgetPosition = "bottom-right";
export const DEFAULT_STOREFRONT_WIDGET_POLICY_ANSWERS: StorefrontPolicyAnswers = {
	contact:
		"For direct support, use the contact details published on the storefront. I can point you to the right page, but I can't open tickets or manage account actions.",
	returns:
		"Return eligibility, timing, and exceptions always follow the store's published return policy. I can summarize the public policy, but Shopify recalculates any order-level eligibility.",
	shipping:
		"Shipping speed, destinations, and rates follow the store's published delivery policy and checkout. I can point you to the public policy, but I can't promise shipping upgrades or hidden rates.",
};
export const DEFAULT_STOREFRONT_WIDGET_QUICK_PROMPTS = [
	"Help me pick a product",
	"Compare a few options",
	"What is the return policy?",
	"Build me a bundle",
];

export interface StorefrontWidgetConfig {
	accentColor: string;
	enabled: boolean;
	greeting: string;
	knowledgeSources: string[];
	policyAnswers: StorefrontPolicyAnswers;
	position: WidgetPosition;
	quickPrompts: string[];
	shopDomain: string;
	shopName: string;
}

export interface StorefrontWidgetReply {
	answer: string;
	cards: StorefrontWidgetCard[];
	cartPlan: CartPlan | null;
	references: StorefrontReference[];
	refusalReason: string | null;
	suggestedPrompts: string[];
	tone: StorefrontReplyTone;
}

export interface StorefrontWidgetSessionSummary {
	createdAt: string;
	lastReplyPreview: string | null;
	lastReplyTone: StorefrontReplyTone | null;
	lastUpdatedAt: string;
	sessionId: string;
	title: string;
}

export interface StorefrontWidgetTranscriptMessage {
	body: string;
	createdAt: string;
	id: string;
	reply?: StorefrontWidgetReply | null;
	role: "assistant" | "user";
}

export interface StorefrontWidgetPageContext {
	canonicalUrl?: string;
	collectionHandle?: string;
	collectionTitle?: string;
	pageType: string;
	productHandle?: string;
	productTitle?: string;
}

export interface StorefrontWidgetSessionDetail {
	messages: StorefrontWidgetTranscriptMessage[];
	sessionId: string;
	title: string;
}

export interface StorefrontWidgetRequest {
	message: string;
	pageContext: StorefrontWidgetPageContext;
	pageTitle?: string;
	sessionId?: string;
	shopDomain: string;
}

export const storefrontPolicyAnswersSchema = z.object({
	contact: z.string().min(8).max(320),
	returns: z.string().min(8).max(320),
	shipping: z.string().min(8).max(320),
});

export const storefrontReferenceSchema = z.object({
	label: z.string().min(1).max(120),
	url: z.string().url().optional(),
});

export const storefrontProductCardSchema = z.object({
	availabilityLabel: z.string().min(1).max(120),
	handle: z.string().min(1).max(120),
	href: z.string().url(),
	imageUrl: z.string().url().optional(),
	kind: z.literal("product"),
	priceLabel: z.string().min(1).max(80),
	summary: z.string().min(1).max(320),
	title: z.string().min(1).max(160),
	vendor: z.string().nullable(),
});

export const storefrontCollectionCardSchema = z.object({
	handle: z.string().min(1).max(120),
	href: z.string().url(),
	kind: z.literal("collection"),
	productCount: z.number().int().nonnegative().nullable(),
	summary: z.string().min(1).max(320),
	title: z.string().min(1).max(160),
});

export const storefrontWidgetCardSchema = z.union([
	storefrontProductCardSchema,
	storefrontCollectionCardSchema,
]);

export const cartPlanItemSchema = z.object({
	productHandle: z.string().min(1).max(120),
	productTitle: z.string().min(1).max(160),
	productUrl: z.string().url(),
	quantity: z.number().int().min(1).max(10),
	variantId: z.string().min(1).max(80),
	variantTitle: z.string().min(1).max(160),
});

export const cartPlanSchema = z.object({
	explanation: z.string().min(1).max(320).optional(),
	items: z.array(cartPlanItemSchema).min(1).max(6),
	note: z.string().min(1).max(200).optional(),
});

export const storefrontWidgetPageContextSchema = z.object({
	canonicalUrl: z.string().url().optional(),
	collectionHandle: z.string().min(1).max(120).optional(),
	collectionTitle: z.string().min(1).max(160).optional(),
	pageType: z.string().min(1).max(80),
	productHandle: z.string().min(1).max(120).optional(),
	productTitle: z.string().min(1).max(160).optional(),
});

export const storefrontWidgetRequestSchema = z.object({
	message: z.string().min(1).max(500),
	pageContext: storefrontWidgetPageContextSchema,
	pageTitle: z.string().min(1).max(200).optional(),
	sessionId: z.string().min(8).max(120).optional(),
	shopDomain: z.string().min(3).max(255),
});

export const storefrontWidgetReplySchema = z.object({
	answer: z.string().min(1).max(1200),
	cards: z.array(storefrontWidgetCardSchema).max(6),
	cartPlan: cartPlanSchema.nullable(),
	references: z.array(storefrontReferenceSchema).max(6),
	refusalReason: z.string().min(1).max(200).nullable(),
	suggestedPrompts: z.array(z.string().min(1).max(120)).max(6),
	tone: z.union([z.literal("answer"), z.literal("refusal")]),
});
