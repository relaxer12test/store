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

export function getOptionalConvexDeploymentUrl() {
	return import.meta.env.VITE_CONVEX_URL as string | undefined;
}

export function getOptionalConvexUrl() {
	return getOptionalConvexDeploymentUrl();
}

export function toConvexHttpUrl(url: string) {
	const parsedUrl = new URL(url);

	if (parsedUrl.hostname.endsWith(".convex.cloud")) {
		parsedUrl.hostname = parsedUrl.hostname.replace(/\.convex\.cloud$/, ".convex.site");
	}

	parsedUrl.pathname = "/";
	parsedUrl.search = "";
	parsedUrl.hash = "";

	return parsedUrl.toString();
}

export function getOptionalConvexHttpUrl() {
	const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;

	if (siteUrl) {
		return toConvexHttpUrl(siteUrl);
	}

	const convexUrl = getOptionalConvexDeploymentUrl();

	if (!convexUrl) {
		return undefined;
	}

	return toConvexHttpUrl(convexUrl);
}

export function buildConvexHttpActionUrl(
	path: string,
	options?: {
		baseUrl?: string;
		search?: string;
	},
) {
	const url = new URL(path, options?.baseUrl ?? getRequiredConvexHttpUrl());

	if (options?.search !== undefined) {
		url.search = options.search;
	}

	return url.toString();
}

export function getOptionalShopifyApiKey() {
	return (
		getMetaContent("shopify-api-key") ??
		getProcessEnv("SHOPIFY_API_KEY") ??
		(import.meta.env.VITE_SHOPIFY_API_KEY as string | undefined)
	);
}

export function getRequiredConvexDeploymentUrl() {
	const url = getOptionalConvexDeploymentUrl();

	if (!url) {
		throw new Error(
			"Missing VITE_CONVEX_URL. Run `CONVEX_AGENT_MODE=anonymous npx convex dev --once` or connect a Convex deployment first.",
		);
	}

	return url;
}

export function getRequiredConvexUrl() {
	return getRequiredConvexDeploymentUrl();
}

export function getRequiredConvexHttpUrl() {
	const url = getOptionalConvexHttpUrl();

	if (!url) {
		throw new Error(
			"Missing Convex HTTP URL. Set `VITE_CONVEX_SITE_URL` or `VITE_CONVEX_URL` before calling HTTP actions.",
		);
	}

	return url;
}
