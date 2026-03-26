import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex-api";
import { getConvexTokenExpiresAt } from "@/lib/convex-auth";
import { getRequiredConvexDeploymentUrl, getRequiredConvexHttpUrl } from "@/lib/env";
import { deriveViewerRoles, type SessionEnvelope } from "@/shared/contracts/session";

const CONVEX_COLOR_PREFIX = "%c[CONVEX ";
const DEFAULT_AUTH_SECRET = "development-only-better-auth-secret-32";
const SHOPIFY_MERCHANT_AUTH_LOG_PREFIX = "[shopify-merchant-auth]";
const SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER = "x-shopify-bridge-secret";
const SHOPIFY_MERCHANT_BOOTSTRAP_REQUEST_ID_HEADER = "x-shopify-bootstrap-request-id";

interface MerchantAuthLogger {
	error: (...args: unknown[]) => void;
	info?: (...args: unknown[]) => void;
	warn?: (...args: unknown[]) => void;
}

interface MerchantBridgeRequest {
	email?: string;
	initials: string;
	lastAuthenticatedAt: number;
	name: string;
	planDisplayName?: string;
	sessionId?: string;
	shopDomain: string;
	shopId: string;
	shopName: string;
	shopifyShopId?: string;
	shopifyUserId: string;
}

interface MerchantBootstrapBridgeResult {
	activeShop: SessionEnvelope["activeShop"];
	bridgeRequest: MerchantBridgeRequest;
}

interface MerchantBridgeSessionResponse {
	activeShop: NonNullable<SessionEnvelope["activeShop"]>;
	betterAuthRole?: string | null;
	merchantRole?: string | null;
	viewer: {
		email: string;
		id: string;
		initials: string;
		name: string;
	};
}

function getBootstrapRequestId() {
	return globalThis.crypto?.randomUUID?.() ?? `bootstrap-${Date.now()}`;
}

function getMerchantAuthLogger(logger?: MerchantAuthLogger): MerchantAuthLogger {
	return logger ?? console;
}

function serializeAuthError(error: unknown) {
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

function getMerchantRequestContext(request: Request, requestId: string) {
	const requestUrl = new URL(request.url);
	const referer = request.headers.get("referer");
	let refererUrl: URL | null = null;

	if (referer) {
		try {
			refererUrl = new URL(referer);
		} catch {
			refererUrl = null;
		}
	}

	return {
		embedded:
			requestUrl.searchParams.get("embedded") ?? refererUrl?.searchParams.get("embedded") ?? null,
		hasBearerToken: Boolean(getBearerToken(request)),
		hasHostParam: Boolean(
			requestUrl.searchParams.get("host") ?? refererUrl?.searchParams.get("host"),
		),
		pathname: requestUrl.pathname,
		refererPathname: refererUrl?.pathname ?? null,
		requestId,
		shop: requestUrl.searchParams.get("shop") ?? refererUrl?.searchParams.get("shop") ?? null,
		userAgent: request.headers.get("user-agent") ?? null,
	};
}

function logMerchantAuthEvent({
	details,
	event,
	level,
	logger,
}: {
	details: Record<string, unknown>;
	event: string;
	level: "error" | "info" | "warn";
	logger: MerchantAuthLogger;
}) {
	const writer =
		level === "warn"
			? (logger.warn ?? logger.error)
			: level === "info"
				? (logger.info ?? logger.error)
				: logger.error;

	writer(`${SHOPIFY_MERCHANT_AUTH_LOG_PREFIX} ${event}`, details);
}

function normalizeConvexLogArgs(args: unknown[]) {
	if (
		typeof args[0] === "string" &&
		args[0].startsWith(CONVEX_COLOR_PREFIX) &&
		typeof args[1] === "string" &&
		args[1].startsWith("color:")
	) {
		return [args[0].slice(2), ...args.slice(2)];
	}

	return args;
}

const convexCloudflareLogger = {
	logVerbose(...args: unknown[]) {
		console.debug(...normalizeConvexLogArgs(args));
	},
	log(...args: unknown[]) {
		console.log(...normalizeConvexLogArgs(args));
	},
	warn(...args: unknown[]) {
		console.warn(...normalizeConvexLogArgs(args));
	},
	error(...args: unknown[]) {
		console.error(...normalizeConvexLogArgs(args));
	},
};

function getBearerToken(request: Request) {
	const authorization = request.headers.get("Authorization");

	if (!authorization?.startsWith("Bearer ")) {
		return null;
	}

	return authorization.slice("Bearer ".length).trim() || null;
}

function toBridgeErrorResponse(message: string, status: number) {
	const headers = new Headers({
		"Cache-Control": "no-store",
		"Content-Type": "application/json",
	});

	return new Response(
		JSON.stringify({
			error: message,
		}),
		{
			headers,
			status,
		},
	);
}

function getBridgeSecret() {
	return process.env.BETTER_AUTH_SECRET?.trim() || DEFAULT_AUTH_SECRET;
}

function getSetCookieHeaders(headers: Headers) {
	const maybeGetSetCookie = (
		headers as Headers & {
			getSetCookie?: () => string[];
		}
	).getSetCookie;

	if (typeof maybeGetSetCookie === "function") {
		const values = maybeGetSetCookie.call(headers);

		if (values.length > 0) {
			return values;
		}
	}

	const setCookie = headers.get("set-cookie");

	if (!setCookie) {
		return [];
	}

	return setCookie.split(/,(?=[^;]+=[^;]+)/g).map((value) => value.trim());
}

function toCookieHeader(setCookieHeaders: string[]) {
	return setCookieHeaders.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

async function readResponseError(response: Response, fallbackMessage: string) {
	const payload = await response
		.clone()
		.json()
		.catch(() => null);

	if (payload && typeof payload.error === "string" && payload.error.length > 0) {
		return payload.error;
	}

	return fallbackMessage;
}

export async function bootstrapShopifyMerchantSession(
	request: Request,
	options?: {
		convexBootstrap?: (sessionToken: string) => Promise<MerchantBootstrapBridgeResult>;
		logger?: MerchantAuthLogger;
	},
) {
	const logger = getMerchantAuthLogger(options?.logger);
	const requestId = getBootstrapRequestId();
	const requestContext = getMerchantRequestContext(request, requestId);
	const sessionToken = getBearerToken(request);

	if (!sessionToken) {
		logMerchantAuthEvent({
			details: requestContext,
			event: "bootstrap_missing_session_token",
			level: "warn",
			logger,
		});

		return toBridgeErrorResponse("Missing Shopify session token.", 401);
	}

	let stage = "prepare_merchant_session";

	try {
		const convexBootstrap =
			options?.convexBootstrap ??
			(async (token: string) => {
				const client = new ConvexHttpClient(getRequiredConvexDeploymentUrl(), {
					logger: convexCloudflareLogger,
				});

				return (await client.action(api.shopify.prepareMerchantAuthBridge, {
					sessionToken: token,
				})) as MerchantBootstrapBridgeResult;
			});
		const convexAuthBaseUrl = getRequiredConvexHttpUrl();
		const bridge = await convexBootstrap(sessionToken);
		const bridgeUrl = new URL("/api/auth/sign-in/shopify-bridge", convexAuthBaseUrl);
		stage = "bridge_sign_in";

		const bridgeResponse = await fetch(bridgeUrl, {
			body: JSON.stringify(bridge.bridgeRequest),
			headers: {
				"content-type": "application/json",
				[SHOPIFY_MERCHANT_BOOTSTRAP_REQUEST_ID_HEADER]: requestId,
				[SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER]: getBridgeSecret(),
			},
			method: "POST",
			redirect: "manual",
		});

		if (!bridgeResponse.ok) {
			const message = await readResponseError(
				bridgeResponse,
				"Merchant bootstrap could not create a Better Auth session.",
			);

			return toBridgeErrorResponse(message, bridgeResponse.status);
		}

		const bridgeCookies = getSetCookieHeaders(bridgeResponse.headers);
		const bridgeCookieHeader = toCookieHeader(bridgeCookies);

		if (!bridgeCookieHeader) {
			return toBridgeErrorResponse(
				"Merchant bootstrap completed without issuing a Better Auth session cookie.",
				500,
			);
		}

		const tokenUrl = new URL("/api/auth/convex/token", convexAuthBaseUrl);
		stage = "issue_convex_jwt";
		const tokenResponse = await fetch(tokenUrl, {
			headers: {
				cookie: bridgeCookieHeader,
			},
			method: "GET",
			redirect: "manual",
		});

		if (!tokenResponse.ok) {
			const message = await readResponseError(
				tokenResponse,
				"Merchant bootstrap completed without issuing a Convex JWT.",
			);

			return toBridgeErrorResponse(message, tokenResponse.status);
		}

		const tokenPayload = (await tokenResponse.json()) as {
			token?: string;
		};
		const convexToken = tokenPayload.token ?? null;

		if (!convexToken) {
			return toBridgeErrorResponse(
				"Merchant bootstrap completed without issuing a Convex JWT.",
				500,
			);
		}

		const bridgePayload = (await bridgeResponse.json()) as MerchantBridgeSessionResponse;
		const roles = deriveViewerRoles({
			betterAuthRole: bridgePayload.betterAuthRole,
			merchantRole: bridgePayload.merchantRole,
		});
		const session: SessionEnvelope = {
			activeShop: bridgePayload.activeShop,
			authMode: "embedded",
			convexToken,
			convexTokenExpiresAt: getConvexTokenExpiresAt(convexToken),
			roles,
			state: "ready",
			viewer: {
				email: bridgePayload.viewer.email,
				id: bridgePayload.viewer.id,
				initials: bridgePayload.viewer.initials,
				name: bridgePayload.viewer.name,
				roles,
			},
		};
		const headers = new Headers({
			"Cache-Control": "no-store",
			"Content-Type": "application/json",
		});

		for (const cookie of [...bridgeCookies, ...getSetCookieHeaders(tokenResponse.headers)]) {
			headers.append("Set-Cookie", cookie);
		}

		return new Response(JSON.stringify(session), {
			headers,
			status: 200,
		});
	} catch (error) {
		logMerchantAuthEvent({
			details: {
				...requestContext,
				error: serializeAuthError(error),
				stage,
			},
			event: "bootstrap_unhandled_failure",
			level: "error",
			logger,
		});

		return toBridgeErrorResponse(
			error instanceof Error ? error.message : "Shopify bootstrap failed.",
			500,
		);
	}
}

export const Route = createFileRoute("/api/shopify/bootstrap")({
	server: {
		handlers: {
			POST: async ({ request }) => bootstrapShopifyMerchantSession(request),
		},
	},
});
