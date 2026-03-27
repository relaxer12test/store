import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/_chrome/internal/install-state")({
	component: InternalInstallStateRoute,
});

function InternalInstallStateRoute() {
	const { data, error, isPending } = useQuery(snapshotQuery);

	if (isPending) {
		return <Text>Loading install state…</Text>;
	}

	if (error || !data) {
		return (
			<Text className="text-red-600 dark:text-red-500">Failed to load install state.</Text>
		);
	}

	return (
		<InternalModulePage
			description="Actual shop installation records currently stored in Convex."
			emptyBody="No Shopify installation records exist in Convex yet."
			emptyTitle="No install records"
			records={data.shops}
			title="Install state"
		/>
	)
}
