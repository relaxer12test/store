import { createFileRoute } from "@tanstack/react-router";
import { MerchantWorkflowsPage } from "@/features/app-shell/components/merchant-workflows-page";
import { useMerchantSnapshot } from "@/features/app-shell/merchant-snapshot";

export const Route = createFileRoute("/app/workflows")({
	component: MerchantWorkflowsRoute,
});

function MerchantWorkflowsRoute() {
	const { data } = useMerchantSnapshot();

	return <MerchantWorkflowsPage snapshot={data} />;
}
