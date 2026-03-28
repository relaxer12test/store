import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Text } from "@/components/ui/cata/text";
import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { CodeValue, formatTimestampLabel, ResourceDetailPage } from "@/components/ui/resource";
import { getInternalWebhookDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/webhooks/$deliveryId")({
	loader: async ({ context, params }) => {
		await context.preload.ensureQueryData(getInternalWebhookDetailQuery(params.deliveryId));
	},
	component: InternalWebhookDetailRoute,
});

function InternalWebhookDetailRoute() {
	const { deliveryId } = Route.useParams();
	const { data } = useSuspenseQuery(getInternalWebhookDetailQuery(deliveryId));

	if (!data) {
		return (
			<ResourceDetailPage backHref="/internal/webhooks" title="Webhook detail unavailable">
				<EmptyState body="The selected webhook delivery could not be loaded." title="Unavailable" />
			</ResourceDetailPage>
		);
	}

	const { payloads, record } = data;

	return (
		<ResourceDetailPage
			backHref="/internal/webhooks"
			description={`${record.status}${record.apiVersion ? ` · ${record.apiVersion}` : ""}`}
			title={record.topic}
		>
			<DescriptionList>
				<DescriptionTerm>Shop</DescriptionTerm>
				<DescriptionDetails>{record.shopName ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Domain</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={record.domain} />
				</DescriptionDetails>
				<DescriptionTerm>Delivery key</DescriptionTerm>
				<DescriptionDetails>{record.deliveryKey ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Event id</DescriptionTerm>
				<DescriptionDetails>{record.eventId ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Webhook id</DescriptionTerm>
				<DescriptionDetails>{record.webhookId ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Received</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(record.receivedAt)}</DescriptionDetails>
				<DescriptionTerm>Processed</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(record.processedAt)}</DescriptionDetails>
				<DescriptionTerm>Error</DescriptionTerm>
				<DescriptionDetails>{record.error ?? "n/a"}</DescriptionDetails>
			</DescriptionList>

			<Panel title="Payload previews">
				{payloads.length === 0 ? (
					<Text>No payload previews were stored for this delivery.</Text>
				) : (
					<div className="space-y-3">
						{payloads.map((payload) => (
							<article
								className="rounded-lg border border-zinc-950/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
								key={payload.id}
							>
								<Text className="text-xs text-zinc-500 dark:text-zinc-400">
									{formatTimestampLabel(payload.createdAt)}
								</Text>
								<pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-zinc-700 dark:text-zinc-300">
									{payload.payloadPreview}
								</pre>
							</article>
						))}
					</div>
				)}
			</Panel>
		</ResourceDetailPage>
	);
}
