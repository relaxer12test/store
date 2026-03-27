import { getRequestHeader, getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
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

function normalizeMyshopifyDomain(value: string | null) {
	const trimmed = value?.trim().toLowerCase();

	if (!trimmed || !/^[a-z0-9-]+\.myshopify\.com$/.test(trimmed)) {
		return null;
	}

	return trimmed;
}

function decodeShopifyHost(value: string | null) {
	if (!value) {
		return null;
	}

	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

	try {
		const decoded =
			typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
		const host = decoded
			.trim()
			.replace(/^https?:\/\//i, "")
			.split("/")[0]
			?.trim()
			.toLowerCase();

		return host || null;
	} catch {
		return null;
	}
}

function toFrameAncestorOrigin(value: string | null) {
	if (!value) {
		return null;
	}

	if (value === "admin.shopify.com" || normalizeMyshopifyDomain(value)) {
		return `https://${value}`;
	}

	return null;
}

function getRefererFrameAncestorOrigin(value: string | null) {
	if (!value) {
		return null;
	}

	try {
		return toFrameAncestorOrigin(new URL(value).hostname.toLowerCase());
	} catch {
		return null;
	}
}

function isEmbeddedEntryPath(pathname: string) {
	return pathname === "/" || pathname === "/app" || pathname.startsWith("/app/");
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

export function getEmbeddedFrameAncestors(
	requestUrl: URL,
	options?: {
		referer?: string | null;
	},
) {
	const ancestors = new Set<string>();
	const shopOrigin = toFrameAncestorOrigin(
		normalizeMyshopifyDomain(requestUrl.searchParams.get("shop")),
	);
	const hostOrigin = toFrameAncestorOrigin(decodeShopifyHost(requestUrl.searchParams.get("host")));
	const refererOrigin = getRefererFrameAncestorOrigin(options?.referer ?? null);
	const isEmbeddedRequest =
		requestUrl.searchParams.get("embedded") === "1" ||
		Boolean(requestUrl.searchParams.get("host")) ||
		Boolean(requestUrl.searchParams.get("shop")) ||
		Boolean(refererOrigin);

	if (shopOrigin) {
		ancestors.add(shopOrigin);
	}

	if (hostOrigin) {
		ancestors.add(hostOrigin);
	}

	if (refererOrigin) {
		ancestors.add(refererOrigin);
	}

	if (isEmbeddedRequest || isEmbeddedEntryPath(requestUrl.pathname)) {
		ancestors.add("https://admin.shopify.com");
	}

	return ancestors.size > 0 ? Array.from(ancestors) : ["'none'"];
}

export function buildEmbeddedAppContentSecurityPolicy(
	requestUrl: URL,
	options?: {
		referer?: string | null;
	},
) {
	return `frame-ancestors ${getEmbeddedFrameAncestors(requestUrl, options).join(" ")};`;
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
