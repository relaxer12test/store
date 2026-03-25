import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { getAppRouterContext } from "@/integrations/app/router-context";
import { routeTree } from "./routeTree.gen.ts";

export function getRouter() {
	const appContext = getAppRouterContext();

	const router = createTanStackRouter({
		routeTree,
		context: appContext,

		scrollRestoration: true,
		defaultPreload: "intent",
		defaultPreloadStaleTime: 0,
		defaultPendingMinMs: 0,
	});

	setupRouterSsrQueryIntegration({
		queryClient: appContext.queryClient,
		router,
		wrapQueryClient: false,
	});

	return router;
}

declare module "@tanstack/react-router" {
	interface Register {
		router: ReturnType<typeof getRouter>;
	}
}
