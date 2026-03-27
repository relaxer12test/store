import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import { InternalHome } from "@/features/internal/components/internal-home";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/_chrome/internal/")({
	component: InternalOverviewRoute,
});

function InternalOverviewRoute() {
	const { data, error, isPending } = useQuery(snapshotQuery);

	if (isPending) {
		return <Text>Loading diagnostics…</Text>;
	}

	if (error || !data) {
		return (
			<Text className="text-red-600 dark:text-red-500">
				Failed to load internal diagnostics.
			</Text>
		);
	}

	return <InternalHome snapshot={data} />;
}
