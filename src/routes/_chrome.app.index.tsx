import { createFileRoute } from "@tanstack/react-router";
import { MerchantHome } from "@/features/app-shell/components/merchant-home";
import {
	merchantOverviewQuery,
	useMerchantOverview,
} from "@/features/app-shell/merchant-workspace";
import { hasEmbeddedMerchantSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/_chrome/app/")({
	loader: async ({ context }) => {
		const session = await context.sessionApi.ensureEmbeddedSession();

		if (hasEmbeddedMerchantSession(session)) {
			await context.preload.ensureQueryData(merchantOverviewQuery);
		}
	},
	component: MerchantOverviewRoute,
});

function MerchantOverviewRoute() {
	const { data } = useMerchantOverview();

	return <MerchantHome overview={data} />;
}
