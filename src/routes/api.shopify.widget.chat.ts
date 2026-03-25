import { createFileRoute } from "@tanstack/react-router";
import { getRequiredConvexUrl } from "@/lib/env";
import { storefrontWidgetRequestSchema } from "@/shared/contracts/storefront-widget";

const PUBLIC_CORS_HEADERS = {
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Origin": "*",
};

function getConvexEndpoint(path: string) {
	return new URL(path, getRequiredConvexUrl()).toString();
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

function jsonWithCors(body: unknown, init: ResponseInit) {
	var headers = new Headers(init.headers);

	Object.entries(PUBLIC_CORS_HEADERS).forEach(function (entry) {
		headers.set(entry[0], entry[1]);
	});

	headers.set("Content-Type", "application/json");

	return new Response(JSON.stringify(body), {
		...init,
		headers: headers,
	});
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

export const Route = createFileRoute("/api/shopify/widget/chat")({
	server: {
		handlers: {
			OPTIONS: async () =>
				new Response(null, {
					headers: PUBLIC_CORS_HEADERS,
					status: 204,
				}),
			POST: async ({ request }) => {
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
				const upstreamResponse = await fetch(getConvexEndpoint("/shopify/widget/chat"), {
					body: JSON.stringify({
						...parsedPayload.data,
						clientFingerprint,
					}),
					headers: {
						Accept: "text/event-stream",
						"Content-Type": "application/json",
					},
					method: "POST",
				});

				return withCors(upstreamResponse);
			},
		},
	},
});
