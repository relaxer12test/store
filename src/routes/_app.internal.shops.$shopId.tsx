import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/cata/button";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Strong, Text } from "@/components/ui/cata/text";
import { Panel } from "@/components/ui/layout";
import { EmptyState } from "@/components/ui/feedback";
import {
	CodeValue,
	ResourceDetailCard,
	StatusValue,
	formatTimestampLabel,
} from "@/components/ui/resource";
import { getInternalShopDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/shops/$shopId")({
	loader: async ({ context, params }) => {
		await context.preload.ensureQueryData(getInternalShopDetailQuery(params.shopId));
	},
	component: InternalShopDetailRoute,
});

function InternalShopDetailRoute() {
	const { shopId } = Route.useParams();
	const { data } = useSuspenseQuery(getInternalShopDetailQuery(shopId));

	if (!data) {
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
	} = data;

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

			<Panel title="Installation">
				{installation ? (
					<DescriptionList>
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
					<Text>No installation record was found for this shop.</Text>
				)}
			</Panel>

			<Panel title="Recent linked records">
				<div className="grid gap-3 sm:grid-cols-2">
					<Button
						className="justify-start"
						href={
							recentCacheStates[0]
								? `/internal/cache/${recentCacheStates[0].id}`
								: "/internal/cache"
						}
						outline
					>
						<div className="min-w-0 text-left">
							<Strong>Cache</Strong>
							<Text className="truncate text-xs">
								{recentCacheStates[0]?.cacheKey ?? "No records"}
							</Text>
						</div>
					</Button>
					<Button
						className="justify-start"
						href={
							recentWorkflows[0]
								? `/internal/workflows/${recentWorkflows[0].id}`
								: "/internal/workflows"
						}
						outline
					>
						<div className="min-w-0 text-left">
							<Strong>Workflows</Strong>
							<Text className="truncate text-xs">
								{recentWorkflows[0]?.type ?? "No records"}
							</Text>
						</div>
					</Button>
					<Button
						className="justify-start"
						href={
							recentWebhookDeliveries[0]
								? `/internal/webhooks/${recentWebhookDeliveries[0].id}`
								: "/internal/webhooks"
						}
						outline
					>
						<div className="min-w-0 text-left">
							<Strong>Webhooks</Strong>
							<Text className="truncate text-xs">
								{recentWebhookDeliveries[0]?.topic ?? "No records"}
							</Text>
						</div>
					</Button>
					<Button
						className="justify-start"
						href={
							recentAiSessions[0]
								? `/internal/ai-sessions/${recentAiSessions[0].id}`
								: "/internal/ai-sessions"
						}
						outline
					>
						<div className="min-w-0 text-left">
							<Strong>AI sessions</Strong>
							<Text className="truncate text-xs">
								{recentAiSessions[0]?.sessionId ?? "No records"}
							</Text>
						</div>
					</Button>
				</div>
			</Panel>
		</ResourceDetailCard>
	);
}
