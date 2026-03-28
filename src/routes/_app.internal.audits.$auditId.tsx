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
import { getInternalAuditDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/audits/$auditId")({
	loader: async ({ context, params }) => {
		await context.preload.ensureQueryData(getInternalAuditDetailQuery(params.auditId));
	},
	component: InternalAuditDetailRoute,
});

function InternalAuditDetailRoute() {
	const { auditId } = Route.useParams();
	const { data } = useSuspenseQuery(getInternalAuditDetailQuery(auditId));

	if (!data) {
		return (
			<ResourceDetailPage backHref="/internal/audits" title="Audit detail unavailable">
				<EmptyState body="The selected audit row could not be loaded." title="Unavailable" />
			</ResourceDetailPage>
		);
	}

	const { record } = data;

	return (
		<ResourceDetailPage
			backHref="/internal/audits"
			description={`${record.status}${record.actorId ? ` · ${record.actorId}` : ""}`}
			title={record.action}
		>
			<DescriptionList>
				<DescriptionTerm>Created</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(record.createdAt)}</DescriptionDetails>
				<DescriptionTerm>Actor</DescriptionTerm>
				<DescriptionDetails>{record.actorId ?? "system"}</DescriptionDetails>
				<DescriptionTerm>Shop</DescriptionTerm>
				<DescriptionDetails>{record.shopName ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Shop domain</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={record.shopDomain} />
				</DescriptionDetails>
				<DescriptionTerm>Detail</DescriptionTerm>
				<DescriptionDetails>{record.detail ?? "n/a"}</DescriptionDetails>
			</DescriptionList>

			<Panel title="Payload">
				{record.payloadJson ? (
					<pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-zinc-700 dark:text-zinc-300">
						{record.payloadJson}
					</pre>
				) : (
					<Text>No structured payload was stored for this audit row.</Text>
				)}
			</Panel>
		</ResourceDetailPage>
	);
}
