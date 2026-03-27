import { createMiddleware, createStart } from "@tanstack/react-start";
import { proxyApiRequestToConvex } from "@/lib/api-proxy";

const apiProxyMiddleware = createMiddleware().server(async ({ next, request }) => {
	const url = new URL(request.url);

	if (!url.pathname.startsWith("/api/")) {
		return await next();
	}

	return await proxyApiRequestToConvex(request);
});

export const startInstance = createStart(() => ({
	requestMiddleware: [apiProxyMiddleware],
}));
