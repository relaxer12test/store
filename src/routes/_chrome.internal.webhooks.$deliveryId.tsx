import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Subheading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";
import { EmptyState } from "@/components/ui/feedback";
import {
	InternalCodeValue,
	InternalStatusValue,
	formatInternalTimestamp,
} from "@/components/ui/resource";
import { InternalDetailCard } from "@/components/ui/resource";
import { getInternalWebhookDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_chrome/internal/webhooks/$deliveryId")({
	component: InternalWebhookDetailRoute,
});

function InternalWebhookDetailRoute() {
	const { deliveryId } = Route.useParams();
	const detailQuery = useQuery(getInternalWebhookDetailQuery(deliveryId));

	if (detailQuery.isPending) {
		return <Text>Loading webhook detail…</Text>;
	}

	if (detailQuery.isError || !detailQuery.data) {
		return (
			<InternalDetailCard title="Webhook detail unavailable">
				<EmptyState body="The selected webhook delivery could not be loaded." title="Unavailable" />
			</InternalDetailCard>
		);
	}

	const { payloads, record } = detailQuery.data;

	return (
		<InternalDetailCard title={record.topic}>
			<div className="flex flex-wrap items-center gap-2">
				<InternalStatusValue value={record.status} />
				{record.apiVersion ? <InternalStatusValue value={record.apiVersion} /> : null}
			</div>

			<DescriptionList>
				<DescriptionTerm>Shop</DescriptionTerm>
				<DescriptionDetails>{record.shopName ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Domain</DescriptionTerm>
				<DescriptionDetails>
					<InternalCodeValue value={record.domain} />
				</DescriptionDetails>
				<DescriptionTerm>Delivery key</DescriptionTerm>
				<DescriptionDetails>{record.deliveryKey ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Event id</DescriptionTerm>
				<DescriptionDetails>{record.eventId ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Webhook id</DescriptionTerm>
				<DescriptionDetails>{record.webhookId ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Received</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(record.receivedAt)}</DescriptionDetails>
				<DescriptionTerm>Processed</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(record.processedAt)}</DescriptionDetails>
				<DescriptionTerm>Error</DescriptionTerm>
				<DescriptionDetails>{record.error ?? "n/a"}</DescriptionDetails>
			</DescriptionList>

			<section className="rounded-[1.6rem] border border-zinc-950/6 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800">
				<Subheading>Payload previews</Subheading>
				{payloads.length === 0 ? (
					<Text className="mt-3">No payload previews were stored for this delivery.</Text>
				) : (
					<div className="mt-3 space-y-3">
						{payloads.map((payload) => (
							<article
								className="rounded-2xl border border-zinc-950/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
								key={payload.id}
							>
								<Text className="text-xs text-zinc-500 dark:text-zinc-400">
									{formatInternalTimestamp(payload.createdAt)}
								</Text>
								<pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-zinc-700 dark:text-zinc-300">
									{payload.payloadPreview}
								</pre>
							</article>
						))}
					</div>
				)}
			</section>
		</InternalDetailCard>
	);
}
