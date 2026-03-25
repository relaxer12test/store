import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MerchantHome } from "@/features/app-shell/components/merchant-home";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/app/")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: MerchantOverviewRoute,
});

function MerchantOverviewRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return <MerchantHome snapshot={data} />;
}
