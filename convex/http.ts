import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { streamStorefrontWidgetReply } from "./storefrontWidgetRuntime";

const http = httpRouter();
const PUBLIC_CORS_HEADERS = {
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Origin": "*",
};

function getBearerToken(request: Request) {
	const authorization = request.headers.get("Authorization");

	if (!authorization?.startsWith("Bearer ")) {
		return null;
	}

	return authorization.slice("Bearer ".length).trim() || null;
}

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

authComponent.registerRoutes(http, createAuth);

http.route({
	path: "/shopify/bootstrap",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const sessionToken = getBearerToken(request);

		if (!sessionToken) {
			return Response.json(
				{
					error: "Missing Shopify session token.",
				},
				{
					status: 401,
					headers: {
						"Cache-Control": "no-store",
					},
				},
			);
		}

		try {
			const session = await ctx.runAction(api.shopify.bootstrapSession, {
				sessionToken,
			});

			return Response.json(session, {
				headers: {
					"Cache-Control": "no-store",
				},
			});
		} catch (error) {
			return Response.json(
				{
					error: error instanceof Error ? error.message : "Shopify bootstrap failed inside Convex.",
				},
				{
					status: 500,
					headers: {
						"Cache-Control": "no-store",
					},
				},
			);
		}
	}),
});

http.route({
	path: "/shopify/webhooks",
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
	path: "/shopify/widget",
	method: "OPTIONS",
	handler: httpAction(
		async () => new Response(null, { status: 204, headers: withPublicCorsHeaders() }),
	),
});

http.route({
	path: "/shopify/widget",
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
	path: "/shopify/widget/chat",
	method: "OPTIONS",
	handler: httpAction(
		async () => new Response(null, { status: 204, headers: withPublicCorsHeaders() }),
	),
});

http.route({
	path: "/shopify/widget/chat",
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
					headers: withPublicCorsHeaders({
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
					headers: withPublicCorsHeaders({
						"Cache-Control": "no-store",
						"Content-Type": "application/json",
					}),
				},
			);
		}

		const response = await streamStorefrontWidgetReply(ctx, {
			clientFingerprint:
				typeof payload.clientFingerprint === "string" ? payload.clientFingerprint : undefined,
			message: payload.message,
			pageTitle: typeof payload.pageTitle === "string" ? payload.pageTitle : undefined,
			sessionId: typeof payload.sessionId === "string" ? payload.sessionId : undefined,
			shopDomain: payload.shopDomain,
		});

		return new Response(response.body, {
			headers: withPublicCorsHeaders(response.headers),
			status: response.status,
			statusText: response.statusText,
		});
	}),
});

http.route({
	path: "/shopify/health",
	method: "GET",
	handler: httpAction(async () =>
		Response.json({
			ok: true,
		}),
	),
});

export default http;
