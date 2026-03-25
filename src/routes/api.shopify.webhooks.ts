import { createFileRoute } from "@tanstack/react-router";
import { getRequiredConvexHttpUrl } from "@/lib/env";

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
	const convexEndpoint = new URL(
		"/shopify/webhooks",
		options?.convexUrl ?? getRequiredConvexHttpUrl(),
	);

	return fetchImpl(convexEndpoint.toString(), {
		method: "POST",
		headers: buildForwardedHeaders(request),
		body: await request.arrayBuffer(),
	});
}

export const Route = createFileRoute("/api/shopify/webhooks")({
	server: {
		handlers: {
			POST: async ({ request }) => forwardShopifyWebhookRequest(request),
		},
	},
});
