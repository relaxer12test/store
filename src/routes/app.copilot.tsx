import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MerchantCopilotPage } from "@/features/app-shell/components/merchant-copilot-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/app/copilot")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: MerchantCopilotRoute,
});

function MerchantCopilotRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return <MerchantCopilotPage snapshot={data} />;
}
