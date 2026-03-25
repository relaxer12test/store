import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MerchantWorkflowsPage } from "@/features/app-shell/components/merchant-workflows-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/app/workflows")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: MerchantWorkflowsRoute,
});

function MerchantWorkflowsRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return <MerchantWorkflowsPage snapshot={data} />;
}
