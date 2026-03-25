import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MerchantExplorerPage } from "@/features/app-shell/components/merchant-explorer-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/app/explorer")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: MerchantExplorerRoute,
});

function MerchantExplorerRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return <MerchantExplorerPage snapshot={data} />;
}
