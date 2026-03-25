import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/internal/cache")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: InternalCacheRoute,
});

function InternalCacheRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return (
		<InternalModulePage
			description="Cache-state rows show which Shopify-backed projections are fresh, stale, disabled, or failing."
			emptyBody="No Shopify cache state has been recorded yet."
			emptyTitle="No cache state"
			records={data.cacheStates}
			title="Cache"
		/>
	);
}
