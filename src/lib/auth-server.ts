import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { betterAuthServer } from "@/lib/better-auth-server";
import { api } from "@/lib/convex-api";
import { getConvexTokenExpiresAt } from "@/lib/convex-auth";
import { bootstrapShopifyMerchantSession } from "@/routes/api.shopify.bootstrap";
import { deriveViewerRoles, type SessionEnvelope } from "@/shared/contracts/session";

const guestSession: SessionEnvelope = {
	authMode: "none",
	state: "ready",
	viewer: null,
	activeShop: null,
	roles: [],
	convexToken: null,
	convexTokenExpiresAt: null,
};
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

function getInitials(name: string) {
	const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

	if (words.length === 0) {
		return "IS";
	}

	return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

async function getBetterAuthSessionEnvelope(): Promise<SessionEnvelope | null> {
	const token = await betterAuthServer.getToken();

	if (!token) {
		return null;
	}

	const viewer = await betterAuthServer.fetchAuthQuery(api.auth.getCurrentViewer, {});

	if (!viewer) {
		return null;
	}

	const roles = deriveViewerRoles({
		betterAuthRole: viewer.betterAuthRole,
		merchantRole: viewer.merchantRole,
	});

	if (
		viewer.authKind === "merchant" &&
		typeof viewer.shopId === "string" &&
		typeof viewer.shopDomain === "string"
	) {
		const shopDomain = viewer.shopDomain;
		const shopName = viewer.shopName ?? shopDomain;

		return {
			authMode: "embedded",
			state: "ready",
			viewer: {
				email: viewer.contactEmail ?? viewer.email,
				id: String(viewer.userId),
				initials: getInitials(viewer.name),
				name: viewer.name,
				roles,
			},
			activeShop: {
				domain: shopDomain,
				id: viewer.shopId,
				installStatus: "connected",
				name: shopName,
			},
			roles,
			convexToken: token,
			convexTokenExpiresAt: getConvexTokenExpiresAt(token),
		} satisfies SessionEnvelope;
	}

	if (viewer.authKind === "admin") {
		return {
			authMode: "internal",
			state: "ready",
			viewer: {
				email: viewer.contactEmail ?? viewer.email,
				id: String(viewer.userId ?? viewer.email),
				initials: getInitials(viewer.name),
				name: viewer.name,
				roles,
			},
			activeShop: null,
			roles,
			convexToken: token,
			convexTokenExpiresAt: getConvexTokenExpiresAt(token),
		} satisfies SessionEnvelope;
	}

	return null;
}

async function getEmbeddedBootstrapSessionEnvelope(
	requestUrl: URL,
): Promise<SessionEnvelope | null> {
	const sessionToken = requestUrl.searchParams.get("id_token");

	if (!sessionToken) {
		return null;
	}

	const headers = new Headers({
		Authorization: `Bearer ${sessionToken}`,
	});
	const referer = getRequestHeader("referer");
	const userAgent = getRequestHeader("user-agent");

	if (referer) {
		headers.set("referer", referer);
	}

	if (userAgent) {
		headers.set("user-agent", userAgent);
	}

	const response = await bootstrapShopifyMerchantSession(
		new Request(requestUrl.toString(), {
			headers,
			method: "POST",
		}),
	);

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

	const setCookie = response.headers.get("set-cookie");

	if (setCookie) {
		setResponseHeader("Set-Cookie", setCookie);
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

export const getSessionEnvelope = createServerFn({ method: "GET" }).handler(async () => {
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
		return (
			(await getBetterAuthSessionEnvelope()) ??
			(await getEmbeddedBootstrapSessionEnvelope(requestUrl)) ??
			guestSession
		);
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
});
