import { createFileRoute } from "@tanstack/react-router";
import { MerchantWorkflowsPage } from "@/features/app-shell/components/merchant-workflows-page";
import {
	merchantWorkflowsQuery,
	useMerchantWorkflows,
} from "@/features/app-shell/merchant-workspace";
import { hasMerchantViewer } from "@/shared/contracts/auth";

export const Route = createFileRoute("/_chrome/app/workflows")({
	loader: async ({ context }) => {
		const viewer = await context.auth.ensureEmbeddedViewer();

		if (hasMerchantViewer(viewer)) {
			await context.preload.ensureQueryData(merchantWorkflowsQuery);
		}
	},
	component: MerchantWorkflowsRoute,
});

function MerchantWorkflowsRoute() {
	const { data } = useMerchantWorkflows();

	return <MerchantWorkflowsPage data={data} />;
}
