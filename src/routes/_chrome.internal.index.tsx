import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InternalHome } from "@/features/internal/components/internal-home";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/_chrome/internal/")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: InternalOverviewRoute,
});

function InternalOverviewRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return <InternalHome snapshot={data} />;
}
