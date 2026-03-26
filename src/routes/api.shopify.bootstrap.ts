import { JWT_COOKIE_NAME } from "@convex-dev/better-auth/plugins";
import { createFileRoute } from "@tanstack/react-router";
import { parseSetCookieHeader, splitSetCookieHeader } from "better-auth/cookies";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex-api";
import { getConvexTokenExpiresAt } from "@/lib/convex-auth";
import { getRequiredConvexDeploymentUrl } from "@/lib/env";
import { deriveViewerRoles, type SessionEnvelope } from "@/shared/contracts/session";

const SHOPIFY_MERCHANT_BRIDGE_PATH = "/sign-in/shopify-bridge";
const SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER = "x-shopify-bridge-secret";
const SHOPIFY_MERCHANT_BOOTSTRAP_REQUEST_ID_HEADER = "x-shopify-bootstrap-request-id";
const CONVEX_COLOR_PREFIX = "%c[CONVEX ";
const SHOPIFY_MERCHANT_AUTH_LOG_PREFIX = "[shopify-merchant-auth]";

interface MerchantAuthLogger {
	error: (...args: unknown[]) => void;
	info?: (...args: unknown[]) => void;
	warn?: (...args: unknown[]) => void;
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

function getCookieNames(setCookieHeaders: string[]) {
	return setCookieHeaders
		.map((setCookie) => parseSetCookieHeader(setCookie).keys().next().value ?? null)
		.filter((cookieName): cookieName is string => Boolean(cookieName));
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

interface MerchantBootstrapBridgeResult {
	bridgePayload: {
		email?: string;
		merchantActorId: string;
		name: string;
		shopDomain: string;
		shopifyUserId: string;
	};
	persistedBootstrap: {
		activeShop: SessionEnvelope["activeShop"];
		roles: SessionEnvelope["roles"];
		viewer: SessionEnvelope["viewer"];
	};
}

function getRequiredBetterAuthSecret() {
	const value =
		(
			globalThis as typeof globalThis & {
				process?: {
					env?: Record<string, string | undefined>;
				};
			}
		).process?.env?.BETTER_AUTH_SECRET?.trim() ?? "";

	if (!value) {
		throw new Error("Missing BETTER_AUTH_SECRET for the Shopify auth bridge.");
	}

	return value;
}

function getBearerToken(request: Request) {
	const authorization = request.headers.get("Authorization");

	if (!authorization?.startsWith("Bearer ")) {
		return null;
	}

	return authorization.slice("Bearer ".length).trim() || null;
}

function getSetCookieHeaders(response: Response) {
	const headers = response.headers as Headers & {
		getSetCookie?: () => string[];
	};

	if (typeof headers.getSetCookie === "function") {
		return headers.getSetCookie();
	}

	const setCookie = response.headers.get("set-cookie");

	return setCookie ? splitSetCookieHeader(setCookie) : [];
}

function appendSetCookieHeaders(headers: Headers, setCookieHeaders: string[]) {
	for (const setCookie of setCookieHeaders) {
		headers.append("Set-Cookie", setCookie);
	}
}

function getCookieValue(setCookieHeaders: string[], cookieName: string) {
	for (const setCookie of setCookieHeaders) {
		const value = parseSetCookieHeader(setCookie).get(cookieName)?.value;

		if (value) {
			return value;
		}
	}

	return null;
}

function toBridgeErrorResponse(message: string, status: number, setCookieHeaders?: string[]) {
	const headers = new Headers({
		"Cache-Control": "no-store",
		"Content-Type": "application/json",
	});

	if (setCookieHeaders) {
		appendSetCookieHeaders(headers, setCookieHeaders);
	}

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

export async function bootstrapShopifyMerchantSession(
	request: Request,
	options?: {
		authSecret?: string;
		convexBootstrap?: (sessionToken: string) => Promise<MerchantBootstrapBridgeResult>;
		fetchImpl?: typeof fetch;
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

	let stage = "prepare_merchant_auth_bridge";

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
		const bridge = await convexBootstrap(sessionToken);
		stage = "call_better_auth_bridge";
		const fetchImpl = options?.fetchImpl ?? fetch;
		const authResponse = await fetchImpl(
			new URL(`/api/auth${SHOPIFY_MERCHANT_BRIDGE_PATH}`, request.url),
			{
				body: JSON.stringify(bridge.bridgePayload),
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
					[SHOPIFY_MERCHANT_BOOTSTRAP_REQUEST_ID_HEADER]: requestId,
					[SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER]:
						options?.authSecret ?? getRequiredBetterAuthSecret(),
				},
				method: "POST",
			},
		);
		const setCookieHeaders = getSetCookieHeaders(authResponse);

		if (!authResponse.ok) {
			let errorMessage = `Merchant auth bridge failed with status ${authResponse.status}.`;

			try {
				const payload = (await authResponse.json()) as {
					error?: {
						message?: string;
					};
					message?: string;
				};
				errorMessage = payload.error?.message ?? payload.message ?? errorMessage;
			} catch {
				// ignore parsing failures and use the status-based fallback
			}

			logMerchantAuthEvent({
				details: {
					...requestContext,
					errorMessage,
					setCookieNames: getCookieNames(setCookieHeaders),
					stage,
					status: authResponse.status,
				},
				event: "bootstrap_bridge_request_failed",
				level: "error",
				logger,
			});

			return toBridgeErrorResponse(errorMessage, authResponse.status, setCookieHeaders);
		}

		stage = "parse_bridge_session";
		const authPayload = (await authResponse.json()) as {
			user: {
				email: string;
				role?: string | null;
			};
		};
		const convexToken = getCookieValue(setCookieHeaders, JWT_COOKIE_NAME);

		if (!convexToken) {
			logMerchantAuthEvent({
				details: {
					...requestContext,
					authUserEmailPresent: Boolean(authPayload.user.email),
					authUserRole: authPayload.user.role ?? null,
					merchantActorId: bridge.bridgePayload.merchantActorId,
					setCookieNames: getCookieNames(setCookieHeaders),
					shopDomain: bridge.bridgePayload.shopDomain,
					stage,
				},
				event: "bootstrap_missing_convex_jwt_cookie",
				level: "error",
				logger,
			});

			return toBridgeErrorResponse(
				"Merchant auth bridge completed without issuing a Convex JWT.",
				500,
				setCookieHeaders,
			);
		}

		const roles = deriveViewerRoles({
			betterAuthRole: authPayload.user.role ?? null,
			merchantRole: "shop_admin",
		});
		const session: SessionEnvelope = {
			authMode: "embedded",
			state: "ready",
			activeShop: bridge.persistedBootstrap.activeShop,
			roles,
			viewer: bridge.persistedBootstrap.viewer
				? {
						...bridge.persistedBootstrap.viewer,
						email: authPayload.user.email,
						roles,
					}
				: null,
			convexToken,
			convexTokenExpiresAt: getConvexTokenExpiresAt(convexToken),
		};
		const headers = new Headers({
			"Cache-Control": "no-store",
			"Content-Type": "application/json",
		});

		appendSetCookieHeaders(headers, setCookieHeaders);

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
