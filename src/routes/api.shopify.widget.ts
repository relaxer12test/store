import { createFileRoute } from "@tanstack/react-router";
import { buildConvexHttpActionUrl } from "@/lib/env";

const PUBLIC_CORS_HEADERS = {
	"Access-Control-Allow-Headers": "Content-Type",
	"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
	"Access-Control-Allow-Origin": "*",
};

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

	return normalizeWidgetConfigError(upstreamResponse);
}

export const Route = createFileRoute("/api/shopify/widget")({
	server: {
		handlers: {
			GET: async ({ request }) => forwardStorefrontWidgetConfigRequest(request),
			OPTIONS: async () =>
				new Response(null, {
					headers: PUBLIC_CORS_HEADERS,
					status: 204,
				}),
		},
	},
});
