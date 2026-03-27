import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import { InternalHome } from "@/features/internal/components/internal-home";
import { internalOverviewQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/")({
	component: InternalOverviewRoute,
});

function InternalOverviewRoute() {
	const { data, error, isPending } = useQuery(internalOverviewQuery);

	if (isPending) {
		return <Text>Loading diagnostics…</Text>;
	}

	if (error || !data) {
		return (
			<Text className="text-red-600 dark:text-red-500">Failed to load internal diagnostics.</Text>
		);
	}

	return <InternalHome snapshot={data} />;
}
