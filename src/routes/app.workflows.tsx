import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MerchantModulePage } from "@/features/app-shell/components/merchant-module-page";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/app/workflows")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(
			convexQuery(api.appShell.merchantModule, { module: "workflows" }),
		);
	},
	component: MerchantWorkflowsRoute,
});

function MerchantWorkflowsRoute() {
	const { data } = useSuspenseQuery(
		convexQuery(api.appShell.merchantModule, { module: "workflows" }),
	);

	return <MerchantModulePage snapshot={data} />;
}
