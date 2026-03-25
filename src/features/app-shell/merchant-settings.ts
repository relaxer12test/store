import { convexAction } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "@/lib/convex-api";

export const merchantSettingsQuery = convexAction(api.merchantApp.settings, {});

export function useMerchantSettings() {
	return useSuspenseQuery({
		queryKey: merchantSettingsQuery.queryKey,
		staleTime: merchantSettingsQuery.staleTime,
	});
}
