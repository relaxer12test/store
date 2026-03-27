import { createFileRoute } from "@tanstack/react-router";
import { MerchantHome } from "@/features/app-shell/components/merchant-home";
import {
	merchantOverviewQuery,
	useMerchantOverview,
} from "@/features/app-shell/merchant-workspace";
import { hasMerchantViewer } from "@/shared/contracts/auth";

export const Route = createFileRoute("/_app/app/")({
	loader: async ({ context }) => {
		const viewer = await context.auth.ensureEmbeddedViewer();

		if (hasMerchantViewer(viewer)) {
			await context.preload.ensureQueryData(merchantOverviewQuery);
		}
	},
	component: MerchantOverviewRoute,
});

function MerchantOverviewRoute() {
	const { data } = useMerchantOverview();

	return <MerchantHome overview={data} />;
}
