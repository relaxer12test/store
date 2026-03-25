export const isServer = typeof window === "undefined";

export function getOptionalConvexUrl() {
	return import.meta.env.VITE_CONVEX_URL as string | undefined;
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
