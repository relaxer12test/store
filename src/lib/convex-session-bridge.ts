import type { SessionEnvelope } from "@/shared/contracts/session";

export const APP_CONVEX_TOKEN_COOKIE_NAME = "gc_convex_token";

function getCookieAttributes(expiresAt: number | null) {
	const segments = ["Path=/", "SameSite=None", "Secure"];

	if (expiresAt && Number.isFinite(expiresAt)) {
		segments.push(`Expires=${new Date(expiresAt).toUTCString()}`);
	}

	return segments.join("; ");
}

export function buildAppConvexTokenCookie(
	session: Pick<SessionEnvelope, "convexToken" | "convexTokenExpiresAt">,
) {
	if (!session.convexToken) {
		return `${APP_CONVEX_TOKEN_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=None; Secure`;
	}

	return `${APP_CONVEX_TOKEN_COOKIE_NAME}=${encodeURIComponent(session.convexToken)}; ${getCookieAttributes(
		session.convexTokenExpiresAt,
	)}`;
}

export function readAppConvexTokenFromCookieHeader(cookieHeader: string | null | undefined) {
	if (!cookieHeader) {
		return null;
	}

	for (const segment of cookieHeader.split(";")) {
		const [rawName, ...rest] = segment.trim().split("=");

		if (rawName === APP_CONVEX_TOKEN_COOKIE_NAME) {
			const value = rest.join("=");
			return value ? decodeURIComponent(value) : null;
		}
	}

	return null;
}

export function persistAppConvexTokenCookie(
	session: Pick<SessionEnvelope, "convexToken" | "convexTokenExpiresAt">,
) {
	if (typeof document === "undefined") {
		return;
	}

	document.cookie = buildAppConvexTokenCookie(session);
}
