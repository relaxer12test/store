import type { WidgetPosition } from "./storefront-widget";

export type ThemeAppEmbedStatus = "enabled" | "disabled" | "not_detected" | "unavailable";

export interface MerchantWidgetSettings {
	accentColor: string;
	enabled: boolean;
	greeting: string;
	knowledgeSources: string[];
	position: WidgetPosition;
}

export interface MerchantInstallHealth {
	apiVersion: string | null;
	appUrl: string;
	installStatus: "pending" | "connected" | "inactive";
	lastAuthenticatedAt: string | null;
	lastTokenExchangeAt: string | null;
	scopes: string[];
	shopDomain: string;
	shopName: string;
	tokenStatus: string;
}

export interface MerchantWebhookHealth {
	lastDeliveryAt: string | null;
	recentDeliveryCount: number;
	recentTopics: string[];
}

export interface MerchantExtensionStatus {
	activationUrl: string | null;
	errorMessage: string | null;
	mainThemeId: string | null;
	mainThemeName: string | null;
	status: ThemeAppEmbedStatus;
}

export interface MerchantSettingsData {
	extensionStatus: MerchantExtensionStatus;
	installHealth: MerchantInstallHealth;
	webhookHealth: MerchantWebhookHealth;
	widgetSettings: MerchantWidgetSettings;
}

export interface MerchantAssistantReply {
	answer: string;
	nextActions: string[];
}
