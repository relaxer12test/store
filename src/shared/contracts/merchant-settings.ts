import type { StorefrontPolicyAnswers, WidgetPosition } from "./storefront-widget";

export type ThemeAppEmbedStatus = "enabled" | "disabled" | "not_detected" | "unavailable";

export interface MerchantWidgetSettings {
	accentColor: string;
	enabled: boolean;
	greeting: string;
	knowledgeSources: string[];
	policyAnswers: StorefrontPolicyAnswers;
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
	failedDeliveryCount: number;
	lastDeliveryAt: string | null;
	recentDeliveryCount: number;
	recentTopics: string[];
}

export interface MerchantCacheStatus {
	cacheKey: string;
	lastCompletedAt: string | null;
	lastError: string | null;
	lastRequestedAt: string | null;
	lastWebhookAt: string | null;
	pendingReason: string | null;
	recordCount: number | null;
	status: string;
	staleWarning: string | null;
}

export interface MerchantCacheHealth {
	caches: MerchantCacheStatus[];
	lastSuccessfulRefreshAt: string | null;
	pendingJobCount: number;
	staleWarnings: string[];
}

export interface MerchantExtensionStatus {
	activationUrl: string | null;
	errorMessage: string | null;
	mainThemeId: string | null;
	mainThemeName: string | null;
	status: ThemeAppEmbedStatus;
}

export interface MerchantSettingsData {
	cacheHealth: MerchantCacheHealth;
	extensionStatus: MerchantExtensionStatus;
	installHealth: MerchantInstallHealth;
	webhookHealth: MerchantWebhookHealth;
	widgetSettings: MerchantWidgetSettings;
}

export interface MerchantAssistantReply {
	answer: string;
	nextActions: string[];
}
