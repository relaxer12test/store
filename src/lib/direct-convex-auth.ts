import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex-api";
import { getRequiredConvexDeploymentUrl, getRequiredConvexHttpUrl } from "@/lib/env";
import {
	buildSessionEnvelopeFromViewer,
	guestSession,
	type CurrentViewerPayload,
} from "@/lib/session-envelope";

const AUTH_STORAGE_PREFIX = "gc-auth";
const AUTH_COOKIE_STORAGE_KEY = `${AUTH_STORAGE_PREFIX}_cookie`;

interface StoredCookie {
	expires: string | null;
	value: string;
}

function getAuthStorage() {
	if (typeof window === "undefined") {
		return null;
	}

	return window.localStorage;
}

function parseSetCookieHeader(header: string) {
	const cookieMap = new Map<string, Record<string, string>>();

	for (const cookie of header.split(", ")) {
		const [nameValue, ...attributes] = cookie.split("; ");
		const [name, value] = nameValue.split("=");

		if (!name) {
			continue;
		}

		const parsedAttributes: Record<string, string> = {
			value: value ?? "",
		};

		for (const attribute of attributes) {
			const [attributeName, attributeValue] = attribute.split("=");
			parsedAttributes[attributeName.toLowerCase()] = attributeValue ?? "";
		}

		cookieMap.set(name, parsedAttributes);
	}

	return cookieMap;
}

function serializeStoredCookies(header: string, previousCookie?: string | null) {
	const parsed = parseSetCookieHeader(header);
	let nextCookieState: Record<string, StoredCookie> = {};

	for (const [key, value] of parsed.entries()) {
		const expiresAt = value.expires
			? new Date(String(value.expires))
			: value["max-age"]
				? new Date(Date.now() + Number(value["max-age"]) * 1000)
				: null;

		nextCookieState[key] = {
			value: value.value ?? "",
			expires: expiresAt ? expiresAt.toISOString() : null,
		};
	}

	if (previousCookie) {
		try {
			nextCookieState = {
				...JSON.parse(previousCookie),
				...nextCookieState,
			};
		} catch {
			// Ignore corrupt local state and replace it with the new cookie payload.
		}
	}

	return JSON.stringify(nextCookieState);
}

function getStoredBetterAuthCookieHeader() {
	const storage = getAuthStorage();

	if (!storage) {
		return "";
	}

	let parsed: Record<string, StoredCookie> = {};

	try {
		parsed = JSON.parse(storage.getItem(AUTH_COOKIE_STORAGE_KEY) ?? "{}") as Record<
			string,
			StoredCookie
		>;
	} catch {
		parsed = {};
	}

	return Object.entries(parsed).reduce((cookieHeader, [key, value]) => {
		if (value.expires && new Date(value.expires) < new Date()) {
			return cookieHeader;
		}

		return cookieHeader ? `${cookieHeader}; ${key}=${value.value}` : `${key}=${value.value}`;
	}, "");
}

function applyBetterAuthCookieHeader(header: string | null) {
	const storage = getAuthStorage();

	if (!storage || !header) {
		return;
	}

	storage.setItem(
		AUTH_COOKIE_STORAGE_KEY,
		serializeStoredCookies(header, storage.getItem(AUTH_COOKIE_STORAGE_KEY)),
	);
}

export function clearStoredBetterAuthBridge() {
	const storage = getAuthStorage();

	if (!storage) {
		return;
	}

	storage.removeItem(AUTH_COOKIE_STORAGE_KEY);
}

async function fetchCurrentViewerWithToken(token: string) {
	const client = new ConvexHttpClient(getRequiredConvexDeploymentUrl());
	client.setAuth(token);

	return (await client.query(api.auth.getCurrentViewer, {})) as CurrentViewerPayload | null;
}

export async function resolveSessionFromConvexToken(token: string) {
	const viewer = await fetchCurrentViewerWithToken(token);
	return buildSessionEnvelopeFromViewer(viewer, token);
}

export async function fetchConvexTokenFromStoredAuth(options?: { forceRefresh?: boolean }) {
	const headers = new Headers();
	const betterAuthCookie = getStoredBetterAuthCookieHeader();

	if (betterAuthCookie) {
		headers.set("Better-Auth-Cookie", betterAuthCookie);
	}

	const response = await fetch(new URL("/api/auth/convex/token", getRequiredConvexHttpUrl()), {
		headers,
		method: "GET",
		credentials: "omit",
	});

	applyBetterAuthCookieHeader(response.headers.get("Set-Better-Auth-Cookie"));

	if (!response.ok) {
		if (options?.forceRefresh) {
			return null;
		}

		throw new Error(`Convex auth token refresh failed with status ${response.status}.`);
	}

	const payload = (await response.json()) as {
		token?: string | null;
	};

	return payload.token ?? null;
}

export async function refreshInternalSessionEnvelope() {
	const token = await fetchConvexTokenFromStoredAuth({
		forceRefresh: true,
	});

	if (!token) {
		return guestSession;
	}

	const session = await resolveSessionFromConvexToken(token);
	return session?.authMode === "internal" ? session : guestSession;
}

export async function requestEmbeddedBootstrapSession(args: {
	requestUrl: string;
	sessionToken: string;
	referer?: string | null;
	userAgent?: string | null;
	fetchImpl?: typeof fetch;
}) {
	const headers = new Headers({
		Accept: "application/json",
		Authorization: `Bearer ${args.sessionToken}`,
	});

	if (args.referer) {
		headers.set("referer", args.referer);
	}

	if (args.userAgent) {
		headers.set("user-agent", args.userAgent);
	}

	return await (args.fetchImpl ?? fetch)(
		new URL(`/shopify/bootstrap${new URL(args.requestUrl).search}`, getRequiredConvexHttpUrl()),
		{
			headers,
			method: "POST",
			redirect: "manual",
			credentials: "omit",
		},
	);
}
