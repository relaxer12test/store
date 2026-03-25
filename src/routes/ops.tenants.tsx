import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { OpsModulePage } from "@/features/ops/components/ops-module-page";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/ops/tenants")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(
			convexQuery(api.appShell.opsModule, { module: "tenants" }),
		);
	},
	component: OpsTenantsRoute,
});

function OpsTenantsRoute() {
	const { data } = useSuspenseQuery(convexQuery(api.appShell.opsModule, { module: "tenants" }));

	return <OpsModulePage snapshot={data} />;
}
