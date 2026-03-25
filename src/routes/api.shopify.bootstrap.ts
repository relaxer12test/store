import { createFileRoute } from "@tanstack/react-router";
import { getRequiredConvexHttpUrl } from "@/lib/env";

export async function forwardShopifyBootstrapRequest(
	request: Request,
	options?: {
		convexUrl?: string;
		fetchImpl?: typeof fetch;
	},
) {
	const authorization = request.headers.get("Authorization");

	if (!authorization) {
		return Response.json(
			{
				error: "Missing Shopify session token.",
			},
			{
				status: 401,
			},
		);
	}

	const fetchImpl = options?.fetchImpl ?? fetch;
	const convexEndpoint = new URL(
		"/shopify/bootstrap",
		options?.convexUrl ?? getRequiredConvexHttpUrl(),
	);

	return fetchImpl(convexEndpoint.toString(), {
		method: "POST",
		headers: {
			Accept: "application/json",
			Authorization: authorization,
		},
	});
}

export const Route = createFileRoute("/api/shopify/bootstrap")({
	server: {
		handlers: {
			POST: async ({ request }) => forwardShopifyBootstrapRequest(request),
		},
	},
});
