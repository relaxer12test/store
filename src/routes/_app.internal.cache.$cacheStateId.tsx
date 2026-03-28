import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Text } from "@/components/ui/cata/text";
import { TextLink } from "@/components/ui/cata/text";
import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { CodeValue, formatTimestampLabel, ResourceDetailPage } from "@/components/ui/resource";
import { getInternalCacheStateDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/cache/$cacheStateId")({
	loader: async ({ context, params }) => {
		await context.preload.ensureQueryData(getInternalCacheStateDetailQuery(params.cacheStateId));
	},
	component: InternalCacheDetailRoute,
});

function InternalCacheDetailRoute() {
	const { cacheStateId } = Route.useParams();
	const { data } = useSuspenseQuery(getInternalCacheStateDetailQuery(cacheStateId));

	if (!data) {
		return (
			<ResourceDetailPage backHref="/internal/cache" title="Cache detail unavailable">
				<EmptyState body="The selected cache state could not be loaded." title="Unavailable" />
			</ResourceDetailPage>
		);
	}

	const { record, recentWebhookDeliveries, recentWorkflows, shopName } = data;

	return (
		<ResourceDetailPage
			backHref="/internal/cache"
			description={`${record.status} · ${record.enabled ? "enabled" : "disabled"}`}
			title={record.cacheKey}
		>
			<DescriptionList>
				<DescriptionTerm>Shop</DescriptionTerm>
				<DescriptionDetails>{shopName}</DescriptionDetails>
				<DescriptionTerm>Domain</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={record.domain} />
				</DescriptionDetails>
				<DescriptionTerm>Updated</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(record.updatedAt)}</DescriptionDetails>
				<DescriptionTerm>Last requested</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(record.lastRequestedAt)}</DescriptionDetails>
				<DescriptionTerm>Last completed</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(record.lastCompletedAt)}</DescriptionDetails>
				<DescriptionTerm>Rows</DescriptionTerm>
				<DescriptionDetails>{String(record.recordCount)}</DescriptionDetails>
				<DescriptionTerm>Pending reason</DescriptionTerm>
				<DescriptionDetails>{record.pendingReason ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Last error</DescriptionTerm>
				<DescriptionDetails>{record.lastError ?? "n/a"}</DescriptionDetails>
			</DescriptionList>

			<Panel title="Linked activity">
				<Text>
					<TextLink href="/internal/workflows">
						{`${recentWorkflows.length} recent workflow${recentWorkflows.length === 1 ? "" : "s"}`}
					</TextLink>
					{" and "}
					<TextLink href="/internal/webhooks">
						{`${recentWebhookDeliveries.length} webhook deliver${recentWebhookDeliveries.length === 1 ? "y" : "ies"}`}
					</TextLink>
					{" for this shop."}
				</Text>
			</Panel>
		</ResourceDetailPage>
	);
}
