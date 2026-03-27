import { createServerFn } from "@tanstack/react-start";
import { fetchAuthQuery, getAuthToken } from "@/lib/auth-server";
import { api } from "@/lib/convex-api";

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
