export const isServer = typeof window === "undefined";

function getProcessEnv(name: string) {
	return (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env?.[name];
}

function getMetaContent(name: string) {
	if (isServer || typeof document === "undefined") {
		return undefined;
	}

	return document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? undefined;
}

export function getOptionalConvexUrl() {
	return import.meta.env.VITE_CONVEX_URL as string | undefined;
}

export function getOptionalShopifyApiKey() {
	return (
		getMetaContent("shopify-api-key") ??
		getProcessEnv("SHOPIFY_API_KEY") ??
		(import.meta.env.VITE_SHOPIFY_API_KEY as string | undefined)
	);
}

export function isInternalToolsEnabled() {
	return import.meta.env.VITE_ENABLE_INTERNAL_TOOLS !== "false";
}

export function getRequiredConvexUrl() {
	const url = getOptionalConvexUrl();

	if (!url) {
		throw new Error(
			"Missing VITE_CONVEX_URL. Run `CONVEX_AGENT_MODE=anonymous npx convex dev --once` or connect a Convex deployment first.",
		);
	}

	return url;
}
