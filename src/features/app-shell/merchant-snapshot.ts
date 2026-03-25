import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "@/lib/convex-api";

export const merchantSnapshotQuery = convexQuery(api.merchantApp.snapshot, {});

export function useMerchantSnapshot() {
	return useSuspenseQuery(merchantSnapshotQuery);
}
