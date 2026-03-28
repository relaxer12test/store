import { createFileRoute } from "@tanstack/react-router";
import { MerchantWorkflowsPage } from "@/features/app-shell/components/merchant-workflows-page";
import {
	merchantWorkflowsQuery,
	useMerchantWorkflows,
} from "@/features/app-shell/merchant-workspace";

export const Route = createFileRoute("/_app/app/workflows")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(merchantWorkflowsQuery);
	},
	component: MerchantWorkflowsRoute,
});

function MerchantWorkflowsRoute() {
	const { data } = useMerchantWorkflows();

	return <MerchantWorkflowsPage data={data} />;
}
