import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/_chrome/internal/cache")({
	component: InternalCacheRoute,
});

function InternalCacheRoute() {
	const { data, error, isPending } = useQuery(snapshotQuery);

	if (isPending) {
		return <Text>Loading cache diagnostics…</Text>;
	}

	if (error || !data) {
		return <Text className="text-red-600 dark:text-red-500">Failed to load cache state.</Text>;
	}

	return (
		<InternalModulePage
			description="Cache-state rows show which Shopify-backed projections are fresh, stale, disabled, or failing."
			emptyBody="No Shopify cache state has been recorded yet."
			emptyTitle="No cache state"
			records={data.cacheStates}
			title="Cache"
		/>
	)
}
