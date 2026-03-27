import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Text } from "@/components/ui/cata/text";
import { EmptyState } from "@/components/ui/feedback";
import {
	InternalCodeValue,
	InternalStatusValue,
	formatInternalTimestamp,
} from "@/components/ui/resource";
import { InternalDetailCard } from "@/components/ui/resource";
import { getInternalAuditDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_chrome/internal/audits/$auditId")({
	component: InternalAuditDetailRoute,
});

function InternalAuditDetailRoute() {
	const { auditId } = Route.useParams();
	const detailQuery = useQuery(getInternalAuditDetailQuery(auditId));

	if (detailQuery.isPending) {
		return <Text>Loading audit detail…</Text>;
	}

	if (detailQuery.isError || !detailQuery.data) {
		return (
			<InternalDetailCard title="Audit detail unavailable">
				<EmptyState body="The selected audit row could not be loaded." title="Unavailable" />
			</InternalDetailCard>
		);
	}

	const { record } = detailQuery.data;

	return (
		<InternalDetailCard title={record.action}>
			<div className="flex flex-wrap items-center gap-2">
				<InternalStatusValue value={record.status} />
				{record.actorId ? <InternalStatusValue value={record.actorId} /> : null}
			</div>

			<DescriptionList>
				<DescriptionTerm>Created</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(record.createdAt)}</DescriptionDetails>
				<DescriptionTerm>Actor</DescriptionTerm>
				<DescriptionDetails>{record.actorId ?? "system"}</DescriptionDetails>
				<DescriptionTerm>Shop</DescriptionTerm>
				<DescriptionDetails>{record.shopName ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Shop domain</DescriptionTerm>
				<DescriptionDetails>
					<InternalCodeValue value={record.shopDomain} />
				</DescriptionDetails>
				<DescriptionTerm>Detail</DescriptionTerm>
				<DescriptionDetails>{record.detail ?? "n/a"}</DescriptionDetails>
			</DescriptionList>

			<section className="rounded-[1.6rem] border border-zinc-950/6 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800">
				<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
					Payload JSON
				</Text>
				{record.payloadJson ? (
					<pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-zinc-700 dark:text-zinc-300">
						{record.payloadJson}
					</pre>
				) : (
					<Text className="mt-3">No structured payload was stored for this audit row.</Text>
				)}
			</section>
		</InternalDetailCard>
	);
}
