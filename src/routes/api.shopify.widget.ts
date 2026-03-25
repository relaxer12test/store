import { createFileRoute } from "@tanstack/react-router";
import { getRequiredConvexUrl } from "@/lib/env";

const PUBLIC_CORS_HEADERS = {
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Origin": "*",
};

function getConvexEndpoint(path: string, search: string) {
	const url = new URL(path, getRequiredConvexUrl());

	url.search = search;

	return url.toString();
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

export const Route = createFileRoute("/api/shopify/widget")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const upstreamResponse = await fetch(
					getConvexEndpoint("/shopify/widget", new URL(request.url).search),
					{
						headers: {
							Accept: "application/json",
						},
						method: "GET",
					},
				);

				return withCors(upstreamResponse);
			},
			OPTIONS: async () =>
				new Response(null, {
					headers: PUBLIC_CORS_HEADERS,
					status: 204,
				}),
		},
	},
});
