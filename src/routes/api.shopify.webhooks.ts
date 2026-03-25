import { createFileRoute } from "@tanstack/react-router";
import { getRequiredConvexUrl } from "@/lib/env";

function getConvexEndpoint(path: string) {
	return new URL(path, getRequiredConvexUrl()).toString();
}

function buildForwardedHeaders(request: Request) {
	const headers = new Headers();

	for (const [key, value] of request.headers.entries()) {
		const lowerKey = key.toLowerCase();

		if (lowerKey === "content-type" || lowerKey.startsWith("x-shopify-")) {
			headers.set(key, value);
		}
	}

	return headers;
}

export const Route = createFileRoute("/api/shopify/webhooks")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				return fetch(getConvexEndpoint("/shopify/webhooks"), {
					method: "POST",
					headers: buildForwardedHeaders(request),
					body: await request.arrayBuffer(),
				});
			},
		},
	},
});
