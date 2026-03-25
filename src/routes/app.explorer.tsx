import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MerchantExplorerPage } from "@/features/app-shell/components/merchant-explorer-page";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/app/explorer")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(
			convexQuery(api.appShell.merchantModule, { module: "explorer" }),
		);
	},
	component: MerchantExplorerRoute,
});

function MerchantExplorerRoute() {
	const { data } = useSuspenseQuery(
		convexQuery(api.appShell.merchantModule, { module: "explorer" }),
	);

	return <MerchantExplorerPage snapshot={data} />;
}
