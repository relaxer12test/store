import { createFileRoute } from "@tanstack/react-router";
import { buildConvexHttpActionUrl } from "@/lib/env";

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

function getBearerToken(request: Request) {
	const authorization = request.headers.get("Authorization");

	if (!authorization?.startsWith("Bearer ")) {
		return null;
	}

	return authorization.slice("Bearer ".length).trim() || null;
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

export async function bootstrapShopifyMerchantSession(
	request: Request,
	options?: {
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

	try {
		const fetchImpl = options?.fetchImpl ?? fetch;
		const convexResponse = await fetchImpl(
			buildConvexHttpActionUrl("/shopify/bootstrap", {
				search: new URL(request.url).search,
			}),
			{
				headers: request.headers,
				method: "POST",
				redirect: "manual",
			},
		);

		return new Response(convexResponse.body, {
			headers: new Headers(convexResponse.headers),
			status: convexResponse.status,
			statusText: convexResponse.statusText,
		});
	} catch (error) {
		logMerchantAuthEvent({
			details: {
				...requestContext,
				error: serializeAuthError(error),
				stage: "proxy_convex_bootstrap",
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
