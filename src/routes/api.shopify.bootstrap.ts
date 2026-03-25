import { createFileRoute } from "@tanstack/react-router";
import { getRequiredConvexUrl } from "@/lib/env";

function getConvexEndpoint(path: string) {
	return new URL(path, getRequiredConvexUrl()).toString();
}

export const Route = createFileRoute("/api/shopify/bootstrap")({
	server: {
		handlers: {
			POST: async ({ request }) => {
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

				return fetch(getConvexEndpoint("/shopify/bootstrap"), {
					method: "POST",
					headers: {
						Accept: "application/json",
						Authorization: authorization,
					},
				});
			},
		},
	},
});
