import { getRequestHeader, getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { buildEmbeddedAppContentSecurityPolicy } from "@/lib/auth-server";
import { betterAuthServer } from "@/lib/better-auth-server";
import {
	buildAppConvexTokenCookie,
	readAppConvexTokenFromCookieHeader,
} from "@/lib/convex-session-bridge";
import {
	requestEmbeddedBootstrapSession,
	resolveSessionFromConvexToken,
} from "@/lib/direct-convex-auth";
import { guestSession } from "@/lib/session-envelope";
import type { SessionEnvelope } from "@/shared/contracts/session";

const SHOPIFY_MERCHANT_AUTH_LOG_PREFIX = "[shopify-merchant-auth]";

function serializeSessionEnvelopeError(error: unknown) {
	if (error instanceof Error) {
		return {
			message: error.message,
			name: error.name,
			stack: error.stack ?? null,
		};
	}

	return {
		message: String(error),
		name: "UnknownError",
		stack: null,
	};
}

async function getBetterAuthSessionEnvelope(): Promise<SessionEnvelope | null> {
	const token = await betterAuthServer.getToken();

	if (!token) {
		return null;
	}

	return await resolveSessionFromConvexToken(token);
}

async function getEmbeddedBootstrapSessionEnvelope(
	requestUrl: URL,
): Promise<SessionEnvelope | null> {
	const sessionToken = requestUrl.searchParams.get("id_token");

	if (!sessionToken) {
		return null;
	}

	const response = await requestEmbeddedBootstrapSession({
		requestUrl: requestUrl.toString(),
		referer: getRequestHeader("referer") ?? null,
		sessionToken,
		userAgent: getRequestHeader("user-agent") ?? null,
	});

	if (!response.ok) {
		const errorPayload = await response
			.clone()
			.json()
			.catch(() => null);

		console.error(`${SHOPIFY_MERCHANT_AUTH_LOG_PREFIX} embedded_session_bootstrap_failed`, {
			embedded: requestUrl.searchParams.get("embedded") ?? null,
			errorPayload,
			pathname: requestUrl.pathname,
			shop: requestUrl.searchParams.get("shop") ?? null,
			status: response.status,
		});

		return null;
	}

	return (await response.json()) as SessionEnvelope;
}

async function getSessionEnvelopeFromRequestToken(cookieHeader: string) {
	const token = readAppConvexTokenFromCookieHeader(cookieHeader);

	if (!token) {
		return null;
	}

	return await resolveSessionFromConvexToken(token).catch(() => null);
}

export async function resolveRequestSessionEnvelope() {
	const requestUrl = getRequestUrl({
		xForwardedHost: true,
		xForwardedProto: true,
	});
	const cookieHeader = getRequestHeader("cookie") ?? "";

	setResponseHeader(
		"Content-Security-Policy",
		buildEmbeddedAppContentSecurityPolicy(requestUrl, {
			referer: getRequestHeader("referer") ?? null,
		}),
	);

	try {
		const session =
			(await getSessionEnvelopeFromRequestToken(cookieHeader)) ??
			(await getBetterAuthSessionEnvelope()) ??
			(await getEmbeddedBootstrapSessionEnvelope(requestUrl)) ??
			guestSession;

		setResponseHeader("Set-Cookie", buildAppConvexTokenCookie(session));

		return session;
	} catch (error) {
		console.error(`${SHOPIFY_MERCHANT_AUTH_LOG_PREFIX} session_envelope_resolution_failed`, {
			embedded: requestUrl.searchParams.get("embedded") ?? null,
			error: serializeSessionEnvelopeError(error),
			hasBetterAuthSessionCookie: cookieHeader.includes("session_token="),
			hasConvexJwtCookie: cookieHeader.includes("convex_jwt="),
			pathname: requestUrl.pathname,
			shop: requestUrl.searchParams.get("shop") ?? null,
		});

		return guestSession;
	}
}
