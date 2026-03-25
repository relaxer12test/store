import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { ConvexHttpClient } from "convex/browser";
import { getBetterAuthToken, fetchAuthQuery } from "@/lib/auth-server";
import { api } from "@/lib/convex-api";
import { getRequiredConvexDeploymentUrl } from "@/lib/env";
import { deriveViewerRoles } from "@/shared/auth/better-auth";
import type { SessionEnvelope } from "@/shared/contracts/session";

const guestSession: SessionEnvelope = {
	authMode: "none",
	state: "ready",
	viewer: null,
	activeShop: null,
	roles: [],
	convexToken: null,
	convexTokenExpiresAt: null,
};

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

function getInitials(name: string) {
	const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

	if (words.length === 0) {
		return "IS";
	}

	return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

async function getBetterAuthSessionEnvelope(): Promise<SessionEnvelope | null> {
	const token = await getBetterAuthToken();

	if (!token) {
		return null;
	}

	const viewer = await fetchAuthQuery(api.auth.getCurrentViewer, {});

	if (!viewer) {
		return null;
	}

	const roles = deriveViewerRoles({
		isInternalStaff: viewer.isInternalStaff,
		role: viewer.role,
	});

	if (
		viewer.authKind === "merchant" &&
		typeof viewer.shopId === "string" &&
		typeof viewer.shopDomain === "string"
	) {
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
				domain: viewer.shopDomain,
				id: viewer.shopId,
				installStatus: "connected",
				name: viewer.shopName ?? viewer.shopDomain,
			},
			roles,
			convexToken: token,
			convexTokenExpiresAt: null,
		} satisfies SessionEnvelope;
	}

	if (viewer.isInternalStaff) {
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
			convexTokenExpiresAt: null,
		} satisfies SessionEnvelope;
	}

	return null;
}

export const ensureInternalStaffAccount = createServerFn({ method: "POST" }).handler(async () => {
	const client = new ConvexHttpClient(getRequiredConvexDeploymentUrl());

	await client.action(api.auth.ensureInternalStaffUser, {});

	return {
		ok: true,
	};
});

export const getSessionEnvelope = createServerFn({ method: "GET" }).handler(async () => {
	const requestUrl = getRequestUrl({
		xForwardedHost: true,
		xForwardedProto: true,
	});

	setResponseHeader(
		"Content-Security-Policy",
		buildEmbeddedAppContentSecurityPolicy(requestUrl, {
			referer: getRequestHeader("referer") ?? null,
		}),
	);

	return (await getBetterAuthSessionEnvelope()) ?? guestSession;
});
