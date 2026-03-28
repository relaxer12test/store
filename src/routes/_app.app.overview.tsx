import { createFileRoute } from "@tanstack/react-router";
import { MerchantHome } from "@/features/app-shell/components/merchant-home";
import {
	merchantOverviewQuery,
	useMerchantOverview,
} from "@/features/app-shell/merchant-workspace";

export const Route = createFileRoute("/_app/app/overview")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(merchantOverviewQuery);
	},
	component: MerchantOverviewRoute,
});

function MerchantOverviewRoute() {
	const { data } = useMerchantOverview();

	return <MerchantHome overview={data} />;
}
