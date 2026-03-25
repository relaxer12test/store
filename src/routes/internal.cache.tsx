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
			description="There is no dedicated projection-cache table in the schema yet. This route stays empty until real cache tables are introduced."
			emptyBody={
				data.syncJobs.length > 0
					? "Sync jobs exist, but there is still no standalone cache/projection table to inspect here."
					: "No projection-cache data exists yet."
			}
			emptyTitle="No cache dataset"
			records={[]}
			title="Cache"
		/>
	);
}
