export type WidgetPosition = "bottom-right" | "bottom-left";

export const DEFAULT_STOREFRONT_WIDGET_ACCENT_COLOR = "#0f172a";
export const DEFAULT_STOREFRONT_WIDGET_GREETING =
	"Ask about products, collections, shipping policies, or what to add to cart.";
export const DEFAULT_STOREFRONT_WIDGET_KNOWLEDGE_SOURCES: string[] = [];
export const DEFAULT_STOREFRONT_WIDGET_POSITION: WidgetPosition = "bottom-right";

export interface StorefrontWidgetConfig {
	accentColor: string;
	enabled: boolean;
	greeting: string;
	knowledgeSources: string[];
	position: WidgetPosition;
	shopDomain: string;
	shopName: string;
}

export interface StorefrontWidgetReply {
	answer: string;
	references: string[];
	suggestedPrompts: string[];
}
