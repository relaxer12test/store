import { createMiddleware, createStart } from "@tanstack/react-start";
import { handleApiProxyRequest } from "@/lib/api-proxy";

const apiProxyMiddleware = createMiddleware().server(async ({ next, request }) => {
	const url = new URL(request.url);

	if (!url.pathname.startsWith("/api/")) {
		return await next();
	}

	const response = await handleApiProxyRequest(request);

	if (response) {
		return response;
	}

	return new Response("Not Found", {
		status: 404,
	});
});

export const startInstance = createStart(() => ({
	requestMiddleware: [apiProxyMiddleware],
}));
