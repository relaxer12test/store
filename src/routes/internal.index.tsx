import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InternalHome } from "@/features/internal/components/internal-home";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/internal/")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(convexQuery(api.appShell.internalOverview, {}));
	},
	component: InternalOverviewRoute,
});

function InternalOverviewRoute() {
	const { data } = useSuspenseQuery(convexQuery(api.appShell.internalOverview, {}));

	return <InternalHome snapshot={data} />;
}
