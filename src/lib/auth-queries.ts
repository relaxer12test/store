import { convexQuery } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/convex-api";

export const currentViewerQuery = convexQuery(api.auth.getCurrentViewer, {});

export async function invalidateAuthQueries(queryClient: QueryClient) {
	await queryClient.invalidateQueries({
		queryKey: currentViewerQuery.queryKey,
	});
}
