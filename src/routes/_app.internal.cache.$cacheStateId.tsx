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
import { getInternalCacheStateDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/cache/$cacheStateId")({
	component: InternalCacheDetailRoute,
});

function InternalCacheDetailRoute() {
	const { cacheStateId } = Route.useParams();
	const detailQuery = useQuery(getInternalCacheStateDetailQuery(cacheStateId));

	if (detailQuery.isPending) {
		return <Text>Loading cache detail…</Text>;
	}

	if (detailQuery.isError || !detailQuery.data) {
		return (
			<InternalDetailCard title="Cache detail unavailable">
				<EmptyState body="The selected cache state could not be loaded." title="Unavailable" />
			</InternalDetailCard>
		);
	}

	const { record, recentWebhookDeliveries, recentWorkflows, shopName } = detailQuery.data;

	return (
		<InternalDetailCard title={record.cacheKey}>
			<div className="flex flex-wrap items-center gap-2">
				<InternalStatusValue value={record.status} />
				<InternalStatusValue value={record.enabled ? "enabled" : "disabled"} />
			</div>

			<DescriptionList>
				<DescriptionTerm>Shop</DescriptionTerm>
				<DescriptionDetails>{shopName}</DescriptionDetails>
				<DescriptionTerm>Domain</DescriptionTerm>
				<DescriptionDetails>
					<InternalCodeValue value={record.domain} />
				</DescriptionDetails>
				<DescriptionTerm>Updated</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(record.updatedAt)}</DescriptionDetails>
				<DescriptionTerm>Last requested</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(record.lastRequestedAt)}</DescriptionDetails>
				<DescriptionTerm>Last completed</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(record.lastCompletedAt)}</DescriptionDetails>
				<DescriptionTerm>Rows</DescriptionTerm>
				<DescriptionDetails>{String(record.recordCount)}</DescriptionDetails>
				<DescriptionTerm>Pending reason</DescriptionTerm>
				<DescriptionDetails>{record.pendingReason ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Last error</DescriptionTerm>
				<DescriptionDetails>{record.lastError ?? "n/a"}</DescriptionDetails>
			</DescriptionList>

			<section className="rounded-lg border border-zinc-950/6 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800">
				<Subheading>Linked activity</Subheading>
				<Text className="mt-3">
					{`${recentWorkflows.length} recent workflow${recentWorkflows.length === 1 ? "" : "s"} and ${recentWebhookDeliveries.length} webhook deliver${recentWebhookDeliveries.length === 1 ? "y" : "ies"} for this shop.`}
				</Text>
			</section>
		</InternalDetailCard>
	);
}
