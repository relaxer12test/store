export const isServer = typeof window === "undefined";

export function getOptionalConvexUrl() {
	return import.meta.env.VITE_CONVEX_URL as string | undefined;
}

export function getOptionalShopifyApiKey() {
	return import.meta.env.VITE_SHOPIFY_API_KEY as string | undefined;
}

export function isInternalToolsEnabled() {
	return import.meta.env.DEV || import.meta.env.VITE_ENABLE_INTERNAL_TOOLS === "true";
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
