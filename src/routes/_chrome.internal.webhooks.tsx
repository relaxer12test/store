import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/_chrome/internal/webhooks")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: InternalWebhooksRoute,
});

function InternalWebhooksRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return (
		<InternalModulePage
			description="Webhook deliveries that have actually been written to Convex."
			emptyBody="No webhook deliveries have been recorded yet."
			emptyTitle="No webhook deliveries"
			records={data.webhookDeliveries}
			title="Webhook deliveries"
		/>
	)
}
