import { createFileRoute } from "@tanstack/react-router";
import { MerchantWorkflowsPage } from "@/features/app-shell/components/merchant-workflows-page";
import {
	merchantWorkflowsQuery,
	useMerchantWorkflows,
} from "@/features/app-shell/merchant-workspace";
import { hasEmbeddedMerchantSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/app/workflows")({
	loader: async ({ context }) => {
		const session = await context.sessionApi.ensureEmbeddedSession();

		if (hasEmbeddedMerchantSession(session)) {
			await context.preload.ensureQueryData(merchantWorkflowsQuery);
		}
	},
	component: MerchantWorkflowsRoute,
});

function MerchantWorkflowsRoute() {
	const { data } = useMerchantWorkflows();

	return <MerchantWorkflowsPage data={data} />;
}
