import { httpRouter } from "convex/server";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

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
	path: "/shopify/health",
	method: "GET",
	handler: httpAction(async () =>
		Response.json({
			ok: true,
		}),
	),
});

export default http;
