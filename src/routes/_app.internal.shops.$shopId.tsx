import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/cata/button";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Subheading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";
import { EmptyState } from "@/components/ui/feedback";
import {
	CodeValue,
	ResourceDetailCard,
	StatusValue,
	formatTimestampLabel,
} from "@/components/ui/resource";
import { getInternalShopDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/shops/$shopId")({
	component: InternalShopDetailRoute,
});

function InternalShopDetailRoute() {
	const { shopId } = Route.useParams();
	const detailQuery = useQuery(getInternalShopDetailQuery(shopId));

	if (detailQuery.isPending) {
		return <Text>Loading shop detail…</Text>;
	}

	if (detailQuery.isError || !detailQuery.data) {
		return (
			<ResourceDetailCard title="Shop unavailable">
				<EmptyState body="The selected shop could not be loaded." title="Detail unavailable" />
			</ResourceDetailCard>
		);
	}

	const {
		installation,
		memberCount,
		organizationCount,
		recentAiSessions,
		recentCacheStates,
		recentWebhookDeliveries,
		recentWorkflows,
		shop,
	} = detailQuery.data;

	return (
		<ResourceDetailCard title={shop.name}>
			<div className="grid gap-4">
				<div className="flex flex-wrap items-center gap-2">
					<StatusValue value={shop.installStatus} />
					<StatusValue value={shop.tokenStatus} />
				</div>

				<DescriptionList>
					<DescriptionTerm>Domain</DescriptionTerm>
					<DescriptionDetails>
						<CodeValue value={shop.domain} />
					</DescriptionDetails>
					<DescriptionTerm>Created</DescriptionTerm>
					<DescriptionDetails>{formatTimestampLabel(shop.createdAt)}</DescriptionDetails>
					<DescriptionTerm>Last authenticated</DescriptionTerm>
					<DescriptionDetails>{formatTimestampLabel(shop.lastAuthenticatedAt)}</DescriptionDetails>
					<DescriptionTerm>Plan</DescriptionTerm>
					<DescriptionDetails>{shop.planDisplayName ?? "n/a"}</DescriptionDetails>
					<DescriptionTerm>Shopify shop id</DescriptionTerm>
					<DescriptionDetails>
						<CodeValue value={shop.shopifyShopId} />
					</DescriptionDetails>
					<DescriptionTerm>Organizations</DescriptionTerm>
					<DescriptionDetails>{String(organizationCount)}</DescriptionDetails>
					<DescriptionTerm>Members</DescriptionTerm>
					<DescriptionDetails>{String(memberCount)}</DescriptionDetails>
				</DescriptionList>
			</div>

			<section className="rounded-lg border border-zinc-950/6 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800">
				<Subheading>Installation</Subheading>
				{installation ? (
					<DescriptionList className="mt-3">
						<DescriptionTerm>Status</DescriptionTerm>
						<DescriptionDetails>{installation.status}</DescriptionDetails>
						<DescriptionTerm>API version</DescriptionTerm>
						<DescriptionDetails>{installation.apiVersion}</DescriptionDetails>
						<DescriptionTerm>Scopes</DescriptionTerm>
						<DescriptionDetails>{String(installation.scopeCount)}</DescriptionDetails>
						<DescriptionTerm>Last token exchange</DescriptionTerm>
						<DescriptionDetails>
							{formatTimestampLabel(installation.lastTokenExchangeAt)}
						</DescriptionDetails>
					</DescriptionList>
				) : (
					<Text className="mt-3">No installation record was found for this shop.</Text>
				)}
			</section>

			<section className="grid gap-4">
				<Subheading>Recent linked records</Subheading>

				<div className="grid gap-3">
					<Button
						href={
							recentCacheStates[0]
								? `/internal/cache/${recentCacheStates[0].id}`
								: "/internal/cache"
						}
						outline
					>
						{recentCacheStates[0] ? `Latest cache: ${recentCacheStates[0].cacheKey}` : "Open cache"}
					</Button>
					<Button
						href={
							recentWorkflows[0]
								? `/internal/workflows/${recentWorkflows[0].id}`
								: "/internal/workflows"
						}
						outline
					>
						{recentWorkflows[0] ? `Latest workflow: ${recentWorkflows[0].type}` : "Open workflows"}
					</Button>
					<Button
						href={
							recentWebhookDeliveries[0]
								? `/internal/webhooks/${recentWebhookDeliveries[0].id}`
								: "/internal/webhooks"
						}
						outline
					>
						{recentWebhookDeliveries[0]
							? `Latest webhook: ${recentWebhookDeliveries[0].topic}`
							: "Open webhooks"}
					</Button>
					<Button
						href={
							recentAiSessions[0]
								? `/internal/ai-sessions/${recentAiSessions[0].id}`
								: "/internal/ai-sessions"
						}
						outline
					>
						{recentAiSessions[0]
							? `Latest AI session: ${recentAiSessions[0].sessionId}`
							: "Open AI sessions"}
					</Button>
				</div>
			</section>
		</ResourceDetailCard>
	);
}
