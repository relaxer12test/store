import { api } from "@convex/_generated/api";
import { httpAction } from "@convex/_generated/server";
import {
	authComponent,
	BETTER_AUTH_IP_HEADERS,
	createAuth,
	getAuthSecret,
	getTrustedAuthOrigins,
} from "@convex/auth";
import { resend } from "@convex/mail";
import { streamStorefrontWidgetReply } from "@convex/storefrontWidgetRuntime";
import { httpRouter } from "convex/server";

const http = httpRouter();
const SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER = "x-shopify-bridge-secret";
const SHOPIFY_MERCHANT_BOOTSTRAP_REQUEST_ID_HEADER = "x-shopify-bootstrap-request-id";
const PUBLIC_CORS_HEADERS = {
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Origin": "*",
};
const PRIVATE_CORS_ALLOWED_ORIGINS = new Set(getTrustedAuthOrigins());
const PRIVATE_CORS_HEADERS = {
	"Access-Control-Allow-Headers": "Authorization, Content-Type",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
};
const STOREFRONT_CORS_HEADERS = {
	"Access-Control-Allow-Headers": "Authorization, Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Credentials": "true",
};

function getWebhookHeaders(request: Request) {
	return {
		apiVersion: request.headers.get("X-Shopify-API-Version") ?? undefined,
		domain: request.headers.get("X-Shopify-Shop-Domain") ?? undefined,
		eventId: request.headers.get("X-Shopify-Event-Id") ?? undefined,
		hmac: request.headers.get("X-Shopify-Hmac-Sha256") ?? undefined,
		name: request.headers.get("X-Shopify-Name") ?? undefined,
		subTopic: request.headers.get("X-Shopify-Sub-Topic") ?? undefined,
		topic: request.headers.get("X-Shopify-Topic") ?? undefined,
		triggeredAt: request.headers.get("X-Shopify-Triggered-At") ?? undefined,
		webhookId: request.headers.get("X-Shopify-Webhook-Id") ?? undefined,
	};
}

function withPublicCorsHeaders(headers?: HeadersInit) {
	const mergedHeaders = new Headers(headers);

	for (const [key, value] of Object.entries(PUBLIC_CORS_HEADERS)) {
		mergedHeaders.set(key, value);
	}

	return mergedHeaders;
}

function withPrivateCorsHeaders(request: Request, headers?: HeadersInit) {
	const mergedHeaders = new Headers(headers);
	const origin = request.headers.get("origin");

	for (const [key, value] of Object.entries(PRIVATE_CORS_HEADERS)) {
		mergedHeaders.set(key, value);
	}

	if (origin && PRIVATE_CORS_ALLOWED_ORIGINS.has(origin)) {
		mergedHeaders.set("Access-Control-Allow-Origin", origin);
		mergedHeaders.append("Vary", "Origin");
	}

	return mergedHeaders;
}

function isAllowedStorefrontOrigin(origin: string) {
	try {
		const url = new URL(origin);

		return (
			PRIVATE_CORS_ALLOWED_ORIGINS.has(origin) ||
			url.hostname === "localhost" ||
			url.hostname === "127.0.0.1" ||
			url.hostname.endsWith(".ldev.cloud")
		);
	} catch {
		return false;
	}
}

function withStorefrontCorsHeaders(request: Request, headers?: HeadersInit) {
	const mergedHeaders = new Headers(headers);
	const origin = request.headers.get("origin");

	for (const [key, value] of Object.entries(STOREFRONT_CORS_HEADERS)) {
		mergedHeaders.set(key, value);
	}

	if (origin && isAllowedStorefrontOrigin(origin)) {
		mergedHeaders.set("Access-Control-Allow-Origin", origin);
		mergedHeaders.append("Vary", "Origin");
	}

	return mergedHeaders;
}

function getBearerToken(request: Request) {
	const authorization = request.headers.get("Authorization");

	if (!authorization?.startsWith("Bearer ")) {
		return null;
	}

	return authorization.slice("Bearer ".length).trim() || null;
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

function appendSetCookieHeaders(targetHeaders: Headers, sourceHeaders: Headers) {
	for (const value of getSetCookieHeaders(sourceHeaders)) {
		targetHeaders.append("set-cookie", value);
	}
}

function buildAuthPassthroughHeaders(request: Request, headers?: HeadersInit) {
	const forwardedHeaders = new Headers(headers);

	for (const headerName of BETTER_AUTH_IP_HEADERS) {
		const headerValue = request.headers.get(headerName);

		if (headerValue) {
			forwardedHeaders.set(headerName, headerValue);
		}
	}

	const userAgent = request.headers.get("user-agent");

	if (userAgent) {
		forwardedHeaders.set("user-agent", userAgent);
	}

	const origin = request.headers.get("origin");

	if (origin) {
		forwardedHeaders.set("origin", origin);
	}

	const referer = request.headers.get("referer");

	if (referer) {
		forwardedHeaders.set("referer", referer);
	}

	return forwardedHeaders;
}

function buildMerchantBridgeHeaders(request: Request, requestId: string) {
	return buildAuthPassthroughHeaders(request, {
		"content-type": "application/json",
		[SHOPIFY_MERCHANT_BOOTSTRAP_REQUEST_ID_HEADER]: requestId,
		[SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER]: getAuthSecret(),
	});
}

async function readResponseError(response: Response, fallbackMessage: string) {
	const payload = await response
		.clone()
		.json()
		.catch(() => null);

	if (payload && typeof payload.error === "string" && payload.error.length > 0) {
		return payload.error;
	}

	if (payload && typeof payload.message === "string" && payload.message.length > 0) {
		return payload.message;
	}

	return fallbackMessage;
}

authComponent.registerRoutes(http, createAuth, {
	cors: true,
});

http.route({
	path: "/api/shopify/widget/auth",
	method: "OPTIONS",
	handler: httpAction(async (_ctx, request) => {
		return new Response(null, {
			headers: withStorefrontCorsHeaders(request),
			status: 204,
		});
	}),
});

http.route({
	path: "/api/shopify/widget/auth",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const auth = createAuth(ctx);
		const incomingCookieHeader = request.headers.get("cookie") ?? "";
		const sessionUrl = new URL("/api/auth/get-session", request.url);
		let sessionResponse = await auth.handler(
			new Request(sessionUrl.toString(), {
				headers: buildAuthPassthroughHeaders(
					request,
					incomingCookieHeader ? { cookie: incomingCookieHeader } : undefined,
				),
				method: "GET",
			}),
		);
		let sessionPayload = await sessionResponse
			.clone()
			.json()
			.catch(() => null);
		let authCookieHeader = "";
		let signInResponse: Response | null = null;

		if (!sessionResponse.ok || !sessionPayload?.user || !sessionPayload?.session) {
			const signInUrl = new URL("/api/auth/sign-in/anonymous", request.url);
			signInResponse = await auth.handler(
				new Request(signInUrl.toString(), {
					body: "{}",
					headers: buildAuthPassthroughHeaders(request, {
						"content-type": "application/json",
					}),
					method: "POST",
				}),
			);

			if (!signInResponse.ok) {
				return Response.json(
					{
						error: await readResponseError(
							signInResponse,
							"Anonymous storefront auth could not be created.",
						),
					},
					{
						headers: withStorefrontCorsHeaders(request, {
							"Cache-Control": "no-store",
						}),
						status: signInResponse.status,
					},
				);
			}

			authCookieHeader = toCookieHeader(getSetCookieHeaders(signInResponse.headers));
			sessionPayload = await signInResponse
				.clone()
				.json()
				.catch(() => null);
		}

		const tokenUrl = new URL("/api/auth/convex/token", request.url);
		const tokenResponse = await auth.handler(
			new Request(tokenUrl.toString(), {
				headers: buildAuthPassthroughHeaders(request, {
					cookie: authCookieHeader || incomingCookieHeader,
				}),
				method: "GET",
			}),
		);

		if (!tokenResponse.ok) {
			return Response.json(
				{
					error: await readResponseError(
						tokenResponse,
						"Anonymous storefront auth could not issue a Convex token.",
					),
				},
				{
					headers: withStorefrontCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: tokenResponse.status,
				},
			);
		}

		const tokenPayload = await tokenResponse
			.clone()
			.json()
			.catch(() => null);
		const responseHeaders = withStorefrontCorsHeaders(request, {
			"Cache-Control": "no-store",
		});

		if (signInResponse) {
			appendSetCookieHeaders(responseHeaders, signInResponse.headers);
		}

		appendSetCookieHeaders(responseHeaders, tokenResponse.headers);

		return Response.json(
			{
				token: typeof tokenPayload?.token === "string" ? tokenPayload.token : null,
				user: sessionPayload?.user
					? {
							id: typeof sessionPayload.user.id === "string" ? sessionPayload.user.id : null,
							isAnonymous: Boolean(sessionPayload.user.isAnonymous),
						}
					: null,
			},
			{
				headers: responseHeaders,
			},
		);
	}),
});

http.route({
	path: "/api/shopify/bootstrap",
	method: "OPTIONS",
	handler: httpAction(async (_ctx, request) => {
		return new Response(null, {
			headers: withPrivateCorsHeaders(request),
			status: 204,
		});
	}),
});

http.route({
	path: "/api/shopify/bootstrap",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const sessionToken = getBearerToken(request);

		if (!sessionToken) {
			return Response.json(
				{
					error: "Missing Shopify session token.",
				},
				{
					headers: withPrivateCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: 401,
				},
			);
		}

		const bridge = await ctx.runAction(api.shopify.prepareMerchantAuthBridge, {
			sessionToken,
		});
		const auth = createAuth(ctx);
		const bridgeUrl = new URL("/api/auth/sign-in/shopify-bridge", request.url);
		const requestId =
			request.headers.get(SHOPIFY_MERCHANT_BOOTSTRAP_REQUEST_ID_HEADER) ??
			globalThis.crypto?.randomUUID?.() ??
			`bootstrap-${Date.now()}`;
		const bridgeResponse = await auth.handler(
			new Request(bridgeUrl.toString(), {
				body: JSON.stringify(bridge.bridgeRequest),
				headers: buildMerchantBridgeHeaders(request, requestId),
				method: "POST",
			}),
		);

		if (!bridgeResponse.ok) {
			return Response.json(
				{
					error: await readResponseError(
						bridgeResponse,
						"Merchant bootstrap could not create a Better Auth session.",
					),
				},
				{
					headers: withPrivateCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: bridgeResponse.status,
				},
			);
		}

		const bridgeCookies = getSetCookieHeaders(bridgeResponse.headers);
		const bridgeCookieHeader = toCookieHeader(bridgeCookies);

		if (!bridgeCookieHeader) {
			return Response.json(
				{
					error: "Merchant bootstrap completed without issuing a Better Auth session cookie.",
				},
				{
					headers: withPrivateCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: 500,
				},
			);
		}

		const tokenUrl = new URL("/api/auth/convex/token", request.url);
		const tokenResponse = await auth.handler(
			new Request(tokenUrl.toString(), {
				headers: buildAuthPassthroughHeaders(request, {
					cookie: bridgeCookieHeader,
				}),
				method: "GET",
			}),
		);

		if (!tokenResponse.ok) {
			return Response.json(
				{
					error: await readResponseError(
						tokenResponse,
						"Merchant bootstrap completed without issuing a Convex JWT.",
					),
				},
				{
					headers: withPrivateCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: tokenResponse.status,
				},
			);
		}

		const tokenPayload = (await tokenResponse.json()) as {
			token?: string;
		};

		if (!tokenPayload.token) {
			return Response.json(
				{
					error: "Merchant bootstrap completed without issuing a Convex JWT.",
				},
				{
					headers: withPrivateCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: 500,
				},
			);
		}

		const headers = withPrivateCorsHeaders(request, {
			"Cache-Control": "no-store",
		});

		for (const cookie of [...bridgeCookies, ...getSetCookieHeaders(tokenResponse.headers)]) {
			headers.append("Set-Cookie", cookie);
		}

		return new Response(null, {
			headers,
			status: 204,
		});
	}),
});

http.route({
	path: "/resend-webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		return await resend.handleResendEventWebhook(ctx, request);
	}),
});

http.route({
	path: "/api/shopify/webhooks",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const rawBody = await request.text();
		const result = await ctx.runAction(api.shopify.processWebhook, {
			headers: getWebhookHeaders(request),
			rawBody,
		});

		if (result.ok) {
			return new Response(null, {
				status: result.status,
			});
		}

		return Response.json(
			{
				error: result.reason ?? "Shopify webhook validation failed.",
			},
			{
				status: result.status,
			},
		);
	}),
});

http.route({
	path: "/api/shopify/widget",
	method: "OPTIONS",
	handler: httpAction(
		async () => new Response(null, { status: 204, headers: withPublicCorsHeaders() }),
	),
});

http.route({
	path: "/api/shopify/widget",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const shopDomain = new URL(request.url).searchParams.get("shop");

		if (!shopDomain) {
			return Response.json(
				{
					error: "Missing `shop` query parameter.",
				},
				{
					status: 400,
					headers: withPublicCorsHeaders({
						"Cache-Control": "no-store",
					}),
				},
			);
		}

		const config = await ctx.runQuery(api.storefrontWidget.getConfig, {
			shopDomain,
		});

		return Response.json(config, {
			headers: withPublicCorsHeaders({
				"Cache-Control": "public, max-age=60, stale-while-revalidate=300",
			}),
		});
	}),
});

http.route({
	path: "/api/shopify/widget/chat",
	method: "OPTIONS",
	handler: httpAction(async (_ctx, request) => {
		return new Response(null, {
			headers: withStorefrontCorsHeaders(request),
			status: 204,
		});
	}),
});

http.route({
	path: "/api/shopify/widget/chat",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		let payload: {
			clientFingerprint?: unknown;
			message?: unknown;
			pageTitle?: unknown;
			sessionId?: unknown;
			shopDomain?: unknown;
		};

		try {
			payload = (await request.json()) as typeof payload;
		} catch {
			return Response.json(
				{
					error: "Widget chat requests must be valid JSON.",
				},
				{
					status: 400,
					headers: withStorefrontCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
				},
			);
		}

		if (typeof payload.shopDomain !== "string" || typeof payload.message !== "string") {
			return new Response(
				JSON.stringify({
					error: "Widget chat requests require `shopDomain` and `message` string fields.",
				}),
				{
					status: 400,
					headers: withStorefrontCorsHeaders(request, {
						"Cache-Control": "no-store",
						"Content-Type": "application/json",
					}),
				},
			);
		}

		const viewer = (await authComponent.safeGetAuthUser(ctx)) as
			| {
					id: string;
			  }
			| undefined;
		const response = await streamStorefrontWidgetReply(ctx, {
			clientFingerprint:
				typeof payload.clientFingerprint === "string" ? payload.clientFingerprint : undefined,
			message: payload.message,
			pageTitle: typeof payload.pageTitle === "string" ? payload.pageTitle : undefined,
			sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
			shopDomain: payload.shopDomain,
			viewerUserId: viewer?.id,
		});

		return new Response(response.body, {
			headers: withStorefrontCorsHeaders(request, response.headers),
			status: response.status,
			statusText: response.statusText,
		});
	}),
});

http.route({
	path: "/api/shopify/widget/sessions",
	method: "OPTIONS",
	handler: httpAction(async (_ctx, request) => {
		return new Response(null, {
			headers: withStorefrontCorsHeaders(request),
			status: 204,
		});
	}),
});

http.route({
	path: "/api/shopify/widget/sessions",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const viewer = await authComponent.safeGetAuthUser(ctx);
		const shopDomain = new URL(request.url).searchParams.get("shop");

		if (!viewer) {
			return Response.json(
				{
					error: "Anonymous storefront auth is required.",
				},
				{
					headers: withStorefrontCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: 401,
				},
			);
		}

		if (!shopDomain) {
			return Response.json(
				{
					error: "Missing `shop` query parameter.",
				},
				{
					headers: withStorefrontCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: 400,
				},
			);
		}

		const sessions = await ctx.runQuery(api.storefrontWidget.listViewerSessions, {
			shopDomain,
		});

		return Response.json(
			{
				sessions,
			},
			{
				headers: withStorefrontCorsHeaders(request, {
					"Cache-Control": "no-store",
				}),
			},
		);
	}),
});

http.route({
	path: "/api/shopify/widget/session",
	method: "OPTIONS",
	handler: httpAction(async (_ctx, request) => {
		return new Response(null, {
			headers: withStorefrontCorsHeaders(request),
			status: 204,
		});
	}),
});

http.route({
	path: "/api/shopify/widget/session",
	method: "GET",
	handler: httpAction(async (ctx, request) => {
		const viewer = await authComponent.safeGetAuthUser(ctx);
		const url = new URL(request.url);
		const sessionId = url.searchParams.get("sessionId");
		const shopDomain = url.searchParams.get("shop");

		if (!viewer) {
			return Response.json(
				{
					error: "Anonymous storefront auth is required.",
				},
				{
					headers: withStorefrontCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: 401,
				},
			);
		}

		if (!shopDomain || !sessionId) {
			return Response.json(
				{
					error: "Missing `shop` or `sessionId` query parameter.",
				},
				{
					headers: withStorefrontCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: 400,
				},
			);
		}

		const session = await ctx.runQuery(api.storefrontWidget.getViewerSessionDetail, {
			sessionId,
			shopDomain,
		});

		if (!session) {
			return Response.json(
				{
					error: "Session not found.",
				},
				{
					headers: withStorefrontCorsHeaders(request, {
						"Cache-Control": "no-store",
					}),
					status: 404,
				},
			);
		}

		return Response.json(session, {
			headers: withStorefrontCorsHeaders(request, {
				"Cache-Control": "no-store",
			}),
		});
	}),
});

http.route({
	path: "/api/shopify/health",
	method: "GET",
	handler: httpAction(async () =>
		Response.json({
			ok: true,
		}),
	),
});

export default http;
