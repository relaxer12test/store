import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { OpsHome } from "@/features/ops/components/ops-home";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/ops/")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(convexQuery(api.appShell.opsOverview, {}));
	},
	component: OpsOverviewRoute,
});

function OpsOverviewRoute() {
	const { data } = useSuspenseQuery(convexQuery(api.appShell.opsOverview, {}));

	return <OpsHome snapshot={data} />;
}
