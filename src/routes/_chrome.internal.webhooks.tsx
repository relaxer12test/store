import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/_chrome/internal/webhooks")({
	component: InternalWebhooksRoute,
});

function InternalWebhooksRoute() {
	const { data, error, isPending } = useQuery(snapshotQuery);

	if (isPending) {
		return <Text>Loading webhook deliveries…</Text>;
	}

	if (error || !data) {
		return (
			<Text className="text-red-600 dark:text-red-500">
				Failed to load webhook deliveries.
			</Text>
		);
	}

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
