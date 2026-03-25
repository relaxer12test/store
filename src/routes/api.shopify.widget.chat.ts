import { createFileRoute } from "@tanstack/react-router";
import { getRequiredConvexUrl } from "@/lib/env";

const PUBLIC_CORS_HEADERS = {
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Origin": "*",
};

function getConvexEndpoint(path: string) {
	return new URL(path, getRequiredConvexUrl()).toString();
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
				const upstreamResponse = await fetch(getConvexEndpoint("/shopify/widget/chat"), {
					body: await request.text(),
					headers: {
						Accept: "application/json",
						"Content-Type": "application/json",
					},
					method: "POST",
				});

				return withCors(upstreamResponse);
			},
		},
	},
});
