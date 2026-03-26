import { JWT_COOKIE_NAME } from "@convex-dev/better-auth/plugins";
import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex-api";
import { getConvexTokenExpiresAt } from "@/lib/convex-auth";
import { getRequiredConvexDeploymentUrl } from "@/lib/env";
import { deriveViewerRoles, type SessionEnvelope } from "@/shared/contracts/session";

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
	merchantSession: {
		expiresAt: number;
		token: string;
	};
	persistedBootstrap: {
		activeShop: SessionEnvelope["activeShop"];
		roles: SessionEnvelope["roles"];
		viewer: SessionEnvelope["viewer"];
	};
}

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

function buildConvexJwtCookie(request: Request, token: string, expiresAt: number) {
	const maxAgeSeconds = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
	const secure = new URL(request.url).protocol === "https:";

	return [
		`${JWT_COOKIE_NAME}=${token}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
		secure ? "Secure" : null,
		`Max-Age=${maxAgeSeconds}`,
	]
		.filter(Boolean)
		.join("; ");
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
		const bridge = await convexBootstrap(sessionToken);
		stage = "issue_convex_jwt";
		const convexToken = bridge.merchantSession.token;
		const convexTokenExpiresAt = bridge.merchantSession.expiresAt;

		if (!convexToken) {
			logMerchantAuthEvent({
				details: {
					...requestContext,
					merchantActorId: bridge.persistedBootstrap.viewer?.id ?? null,
					shopDomain: bridge.persistedBootstrap.activeShop?.domain ?? null,
					stage,
				},
				event: "bootstrap_missing_convex_token",
				level: "error",
				logger,
			});

			return toBridgeErrorResponse(
				"Merchant bootstrap completed without issuing a Convex JWT.",
				500,
			);
		}

		const roles = deriveViewerRoles({
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
						email: bridge.persistedBootstrap.viewer.email,
						roles,
					}
				: null,
			convexToken,
			convexTokenExpiresAt: convexTokenExpiresAt ?? getConvexTokenExpiresAt(convexToken),
		};
		const headers = new Headers({
			"Cache-Control": "no-store",
			"Content-Type": "application/json",
		});

		headers.append(
			"Set-Cookie",
			buildConvexJwtCookie(request, convexToken, session.convexTokenExpiresAt ?? Date.now()),
		);

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
