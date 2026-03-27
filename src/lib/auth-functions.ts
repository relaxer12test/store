import { createServerFn } from "@tanstack/react-start";
import { api } from "@/lib/convex-api";
import { fetchAuthQuery, getAuthToken } from "@/lib/auth-server";

export const getCurrentViewerServer = createServerFn({ method: "GET" }).handler(async () => {
	return await fetchAuthQuery(api.auth.getCurrentViewer, {});
});

export const getAuthBootstrap = createServerFn({ method: "GET" }).handler(async () => {
	const token = await getAuthToken();
	const viewer = await fetchAuthQuery(api.auth.getCurrentViewer, {});

	return {
		token,
		viewer,
	};
});
