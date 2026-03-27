import { buildConvexHttpActionUrl } from "@/lib/env";
import { authHandler } from "@/lib/auth-server";
import { storefrontWidgetRequestSchema } from "@/shared/contracts/storefront-widget";

const SHOPIFY_MERCHANT_AUTH_LOG_PREFIX = "[shopify-merchant-auth]";
const PUBLIC_CORS_HEADERS = {
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Origin": "*",
};

interface MerchantAuthLogger {
	error: (...args: unknown[]) => void;
	info?: (...args: unknown[]) => void;
	warn?: (...args: unknown[]) => void;
}

function withCors(response: Response) {
	const headers = new Headers(response.headers);

	for (const [key, value] of Object.entries(PUBLIC_CORS_HEADERS)) {
		headers.set(key, value);
	}

	return new Response(response.body, {
		headers,
		status: response.status,
		statusText: response.statusText,
	});
}

function jsonWithCors(body: unknown, init: ResponseInit) {
	const headers = new Headers(init.headers);

	Object.entries(PUBLIC_CORS_HEADERS).forEach(([key, value]) => {
		headers.set(key, value);
	});

	headers.set("Content-Type", "application/json");

	return new Response(JSON.stringify(body), {
		...init,
		headers,
	});
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

export function buildForwardedHeaders(request: Request) {
	const headers = new Headers();

	for (const [key, value] of request.headers.entries()) {
		const lowerKey = key.toLowerCase();

		if (lowerKey === "content-type" || lowerKey.startsWith("x-shopify-")) {
			headers.set(key, value);
		}
	}

	return headers;
}

export async function forwardShopifyWebhookRequest(
	request: Request,
	options?: {
		convexUrl?: string;
		fetchImpl?: typeof fetch;
	},
) {
	const fetchImpl = options?.fetchImpl ?? fetch;

	return fetchImpl(
		buildConvexHttpActionUrl("/shopify/webhooks", {
			baseUrl: options?.convexUrl,
		}),
		{
			method: "POST",
			headers: buildForwardedHeaders(request),
			body: await request.arrayBuffer(),
		},
	);
}

async function normalizeWidgetConfigError(response: Response) {
	if (response.ok) {
		return withCors(response);
	}

	const contentType = response.headers.get("Content-Type") ?? "";

	if (contentType.toLowerCase().includes("application/json")) {
		return withCors(response);
	}

	return Response.json(
		{
			error: `Storefront widget configuration failed upstream with status ${response.status}.`,
		},
		{
			headers: PUBLIC_CORS_HEADERS,
			status: response.status,
			statusText: response.statusText,
		},
	);
}

export async function forwardStorefrontWidgetConfigRequest(
	request: Request,
	options?: {
		convexUrl?: string;
		fetchImpl?: typeof fetch;
	},
) {
	const fetchImpl = options?.fetchImpl ?? fetch;

	const upstreamResponse = await fetchImpl(
		buildConvexHttpActionUrl("/shopify/widget", {
			baseUrl: options?.convexUrl,
			search: new URL(request.url).search,
		}),
		{
			headers: {
				Accept: "application/json",
			},
			method: "GET",
		},
	);

	return await normalizeWidgetConfigError(upstreamResponse);
}

function getClientIp(request: Request) {
	const forwardedFor = request.headers.get("x-forwarded-for");

	if (forwardedFor) {
		return forwardedFor.split(",")[0]?.trim() || null;
	}

	return (
		request.headers.get("cf-connecting-ip") ??
		request.headers.get("x-real-ip") ??
		request.headers.get("fly-client-ip")
	);
}

async function hashValue(value: string) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));

	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

async function getClientFingerprint(request: Request) {
	const clientIp = getClientIp(request);

	if (!clientIp) {
		return undefined;
	}

	return await hashValue(clientIp);
}

async function normalizeWidgetChatError(response: Response) {
	if (response.ok) {
		return withCors(response);
	}

	const contentType = response.headers.get("Content-Type") ?? "";

	if (contentType.toLowerCase().includes("application/json")) {
		return withCors(response);
	}

	return jsonWithCors(
		{
			error: `Storefront widget chat failed upstream with status ${response.status}.`,
		},
		{
			status: response.status,
			statusText: response.statusText,
		},
	);
}

export async function forwardStorefrontWidgetChatRequest(
	request: Request,
	options?: {
		convexUrl?: string;
		fetchImpl?: typeof fetch;
	},
) {
	let payload: unknown;

	try {
		payload = await request.json();
	} catch {
		return jsonWithCors(
			{
				error: "Widget chat requests must be valid JSON.",
			},
			{
				status: 400,
			},
		);
	}

	const parsedPayload = storefrontWidgetRequestSchema.safeParse(payload);

	if (!parsedPayload.success) {
		return jsonWithCors(
			{
				error:
					"Widget chat requests require `shopDomain` and `message`, with optional `pageTitle` and `sessionId` strings.",
			},
			{
				status: 400,
			},
		);
	}

	const clientFingerprint = await getClientFingerprint(request);
	const fetchImpl = options?.fetchImpl ?? fetch;
	const upstreamResponse = await fetchImpl(
		buildConvexHttpActionUrl("/shopify/widget/chat", {
			baseUrl: options?.convexUrl,
		}),
		{
			body: JSON.stringify({
				...parsedPayload.data,
				clientFingerprint,
			}),
			headers: {
				Accept: "text/event-stream",
				"Content-Type": "application/json",
			},
			method: "POST",
		},
	);

	return await normalizeWidgetChatError(upstreamResponse);
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
		const headers = new Headers({
			Authorization: `Bearer ${sessionToken}`,
		});
		const referer = request.headers.get("referer");
		const userAgent = request.headers.get("user-agent");

		if (referer) {
			headers.set("referer", referer);
		}

		if (userAgent) {
			headers.set("user-agent", userAgent);
		}

		const convexResponse = await (options?.fetchImpl ?? fetch)(
			buildConvexHttpActionUrl("/shopify/bootstrap", {
				search: new URL(request.url).search,
			}),
			{
				credentials: "omit",
				headers,
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

export async function handleApiProxyRequest(request: Request) {
	const url = new URL(request.url);

	if (url.pathname === "/api/auth/get-session") {
		if (request.method === "GET" || request.method === "POST") {
			return await authHandler(request);
		}
	}

	if (url.pathname === "/api/auth/sign-in/email" && request.method === "POST") {
		return await authHandler(request);
	}

	if (url.pathname === "/api/auth/sign-out" && request.method === "POST") {
		return await authHandler(request);
	}

	if (url.pathname === "/api/auth/request-password-reset" && request.method === "POST") {
		return await authHandler(request);
	}

	if (url.pathname === "/api/auth/reset-password" && request.method === "POST") {
		return await authHandler(request);
	}

	if (url.pathname === "/api/auth/convex/token" && request.method === "GET") {
		return await authHandler(request);
	}

	if (url.pathname === "/api/auth/admin/list-users" && request.method === "GET") {
		return await authHandler(request);
	}

	if (url.pathname === "/api/auth/admin/set-role" && request.method === "POST") {
		return await authHandler(request);
	}

	if (url.pathname === "/api/shopify/webhooks" && request.method === "POST") {
		return await forwardShopifyWebhookRequest(request);
	}

	if (url.pathname === "/api/shopify/widget" && request.method === "GET") {
		return await forwardStorefrontWidgetConfigRequest(request);
	}

	if (url.pathname === "/api/shopify/widget" && request.method === "OPTIONS") {
		return new Response(null, {
			headers: PUBLIC_CORS_HEADERS,
			status: 204,
		});
	}

	if (url.pathname === "/api/shopify/widget/chat" && request.method === "POST") {
		return await forwardStorefrontWidgetChatRequest(request);
	}

	if (url.pathname === "/api/shopify/widget/chat" && request.method === "OPTIONS") {
		return new Response(null, {
			headers: PUBLIC_CORS_HEADERS,
			status: 204,
		});
	}

	if (url.pathname === "/api/shopify/bootstrap" && request.method === "POST") {
		return await bootstrapShopifyMerchantSession(request);
	}

	return null;
}
