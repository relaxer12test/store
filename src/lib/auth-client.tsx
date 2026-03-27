import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { useQuery } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";
import { currentViewerQuery } from "@/lib/auth-queries";
import { hasAdminViewer, hasMerchantViewer } from "@/shared/contracts/auth";

export const authClient = createAuthClient({
	basePath: "/api/auth",
	plugins: [adminClient(), convexClient()],
});

export function useCurrentViewer() {
	return useQuery(currentViewerQuery);
}

export function useAppAuth() {
	const session = authClient.useSession();
	const viewerQuery = useCurrentViewer();
	const viewer = viewerQuery.data ?? null;

	return {
		hasSession: Boolean(session.data?.session),
		isAdmin: hasAdminViewer(viewer),
		isMerchant: hasMerchantViewer(viewer),
		isPending: session.isPending || viewerQuery.isPending,
		session,
		viewer,
		viewerQuery,
	};
}
