import { ApiVersion, shopifyApi } from "@shopify/shopify-api";
import { webApiAdapterInitialized } from "@shopify/shopify-api/adapters/web-api";
import type { ThemeAppEmbedStatus } from "../src/shared/contracts/merchant-settings";

if (!webApiAdapterInitialized) {
	throw new Error("Failed to initialize Shopify Web API adapter.");
}

const THEME_APP_EMBED_DIAGNOSTICS_QUERY = `
	query ThemeEmbedDiagnostics {
		themes(first: 1, roles: [MAIN]) {
			nodes {
				id
				name
				role
				files(filenames: ["config/settings_data.json"], first: 1) {
					nodes {
						filename
						body {
							... on OnlineStoreThemeFileBodyText {
								content
							}
						}
					}
				}
			}
		}
	}
`;

export const SHOPIFY_API_VERSION = ApiVersion.January26;
export const STOREFRONT_APP_EMBED_BLOCK_HANDLE = "storefront-ai-embed";

type ThemeFileBodyText = {
	content: string;
};

interface ThemeEmbedDiagnosticsResponse {
	themes?: {
		nodes?: Array<{
			files?: {
				nodes?: Array<{
					body?: ThemeFileBodyText | null;
					filename?: string | null;
				}> | null;
			} | null;
			id?: string | null;
			name?: string | null;
			role?: string | null;
		}>;
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeShopifyErrorMessages(value: unknown): string[] {
	if (typeof value === "string") {
		const message = value.trim();
		return message ? [message] : [];
	}

	if (Array.isArray(value)) {
		return value.flatMap((entry) => normalizeShopifyErrorMessages(entry));
	}

	if (!isRecord(value)) {
		return [];
	}

	const directMessage = typeof value.message === "string" ? value.message.trim() : null;

	if (directMessage) {
		return [directMessage];
	}

	return Object.values(value).flatMap((entry) => normalizeShopifyErrorMessages(entry));
}

function summarizeResponseBody(body: string) {
	const summary = body.trim().replace(/\s+/g, " ");
	return summary ? summary.slice(0, 280) : null;
}

function getProcessEnv() {
	return (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env;
}

export function getRequiredShopifyEnv(name: string) {
	const value = getProcessEnv()?.[name];

	if (!value) {
		throw new Error(`Missing Convex environment variable ${name}.`);
	}

	return value;
}

export function createShopifyClient() {
	const appUrl = new URL(getRequiredShopifyEnv("SHOPIFY_APP_URL"));

	return shopifyApi({
		apiKey: getRequiredShopifyEnv("SHOPIFY_API_KEY"),
		apiSecretKey: getRequiredShopifyEnv("SHOPIFY_API_SECRET"),
		apiVersion: SHOPIFY_API_VERSION,
		hostName: appUrl.host,
		hostScheme: appUrl.protocol === "https:" ? "https" : "http",
		isEmbeddedApp: true,
	});
}

export async function shopifyAdminGraphqlRequest<TData>({
	accessToken,
	query,
	shop,
	variables,
}: {
	accessToken: string;
	query: string;
	shop: string;
	variables?: Record<string, unknown>;
}): Promise<TData> {
	const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Shopify-Access-Token": accessToken,
		},
		body: JSON.stringify({
			query,
			variables,
		}),
	});

	const responseBody = await response.text();
	let payload: {
		data?: TData | null;
		errors?: unknown;
	} | null = null;

	if (responseBody) {
		try {
			payload = JSON.parse(responseBody) as {
				data?: TData | null;
				errors?: unknown;
			};
		} catch {
			payload = null;
		}
	}

	const errorMessages = Array.from(new Set(normalizeShopifyErrorMessages(payload?.errors)));

	if (!response.ok || errorMessages.length > 0 || payload?.data == null) {
		const fallbackMessage =
			summarizeResponseBody(responseBody) ??
			`Shopify Admin API request failed with status ${response.status}.`;

		throw new Error(errorMessages.join("; ") || fallbackMessage);
	}

	return payload.data;
}

export function parseThemeAppEmbedStatus(settingsDataContent: string, embedBlockHandle: string) {
	const parsed = JSON.parse(settingsDataContent) as {
		current?: {
			blocks?: Record<
				string,
				{
					disabled?: boolean;
					type?: string;
				}
			>;
		};
	};

	const blocks = parsed.current?.blocks;

	if (!blocks) {
		return "not_detected" as ThemeAppEmbedStatus;
	}

	for (const block of Object.values(blocks)) {
		if (!block?.type?.includes(`/blocks/${embedBlockHandle}/`)) {
			continue;
		}

		return block.disabled ? "disabled" : "enabled";
	}

	return "not_detected" as ThemeAppEmbedStatus;
}

export function buildThemeEditorAppEmbedDeepLink(shopDomain: string) {
	const url = new URL(`https://${shopDomain}/admin/themes/current/editor`);

	url.searchParams.set("context", "apps");
	url.searchParams.set("template", "index");
	url.searchParams.set(
		"activateAppId",
		`${getRequiredShopifyEnv("SHOPIFY_API_KEY")}/${STOREFRONT_APP_EMBED_BLOCK_HANDLE}`,
	);

	return url.toString();
}

export async function fetchThemeAppEmbedDiagnostics({
	accessToken,
	embedBlockHandle = STOREFRONT_APP_EMBED_BLOCK_HANDLE,
	shopDomain,
}: {
	accessToken: string;
	embedBlockHandle?: string;
	shopDomain: string;
}): Promise<{
	activationUrl: string;
	mainThemeId: string | null;
	mainThemeName: string | null;
	status: ThemeAppEmbedStatus;
}> {
	const payload = await shopifyAdminGraphqlRequest<ThemeEmbedDiagnosticsResponse>({
		accessToken,
		query: THEME_APP_EMBED_DIAGNOSTICS_QUERY,
		shop: shopDomain,
	});
	const mainTheme = payload.themes?.nodes?.[0];
	const settingsFile = mainTheme?.files?.nodes?.[0];

	let status: ThemeAppEmbedStatus = "not_detected";

	if (settingsFile?.body && "content" in settingsFile.body) {
		status = parseThemeAppEmbedStatus(settingsFile.body.content, embedBlockHandle);
	}

	return {
		activationUrl: buildThemeEditorAppEmbedDeepLink(shopDomain),
		mainThemeId: mainTheme?.id ?? null,
		mainThemeName: mainTheme?.name ?? null,
		status,
	};
}
