import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InternalHome } from "@/features/internal/components/internal-home";
import { internalOverviewQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/overview")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(internalOverviewQuery);
	},
	component: InternalOverviewRoute,
});

function InternalOverviewRoute() {
	const { data } = useSuspenseQuery(internalOverviewQuery);

	return <InternalHome snapshot={data} />;
}
