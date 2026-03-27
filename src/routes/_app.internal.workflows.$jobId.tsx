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
import { getInternalWorkflowDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/workflows/$jobId")({
	component: InternalWorkflowDetailRoute,
});

function InternalWorkflowDetailRoute() {
	const { jobId } = Route.useParams();
	const detailQuery = useQuery(getInternalWorkflowDetailQuery(jobId));

	if (detailQuery.isPending) {
		return <Text>Loading workflow detail…</Text>;
	}

	if (detailQuery.isError || !detailQuery.data) {
		return (
			<InternalDetailCard title="Workflow detail unavailable">
				<EmptyState body="The selected workflow could not be loaded." title="Unavailable" />
			</InternalDetailCard>
		)
	}

	const { logs, record } = detailQuery.data;

	return (
		<InternalDetailCard title={record.type}>
			<div className="flex flex-wrap items-center gap-2">
				<InternalStatusValue value={record.status} />
				{record.source ? <InternalStatusValue value={record.source} /> : null}
			</div>

			<DescriptionList>
				<DescriptionTerm>Shop</DescriptionTerm>
				<DescriptionDetails>{record.shopName}</DescriptionDetails>
				<DescriptionTerm>Domain</DescriptionTerm>
				<DescriptionDetails>
					<InternalCodeValue value={record.domain} />
				</DescriptionDetails>
				<DescriptionTerm>Requested</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(record.requestedAt)}</DescriptionDetails>
				<DescriptionTerm>Started</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(record.startedAt)}</DescriptionDetails>
				<DescriptionTerm>Completed</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(record.completedAt)}</DescriptionDetails>
				<DescriptionTerm>Retry</DescriptionTerm>
				<DescriptionDetails>{String(record.retryCount)}</DescriptionDetails>
				<DescriptionTerm>Cache key</DescriptionTerm>
				<DescriptionDetails>{record.cacheKey ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Result summary</DescriptionTerm>
				<DescriptionDetails>{record.resultSummary ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Error</DescriptionTerm>
				<DescriptionDetails>{record.error ?? "n/a"}</DescriptionDetails>
			</DescriptionList>

			<section className="rounded-lg border border-zinc-950/6 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800">
				<Subheading>Workflow log</Subheading>
				{logs.length === 0 ? (
					<Text className="mt-3">No workflow logs were recorded for this job.</Text>
				) : (
					<ol className="mt-3 space-y-3">
						{logs.map((log) => (
							<li
								className="rounded-2xl border border-zinc-950/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
								key={`${log.createdAt}-${log.message}`}
							>
								<div className="flex flex-wrap items-center gap-2">
									<InternalStatusValue value={log.level} />
									<Text className="text-xs text-zinc-500 dark:text-zinc-400">
										{formatInternalTimestamp(log.createdAt)}
									</Text>
								</div>
								<Text className="mt-2 font-semibold text-zinc-950 dark:text-white">
									{log.message}
								</Text>
								{log.detail ? <Text className="mt-1">{log.detail}</Text> : null}
							</li>
						))}
					</ol>
				)}
			</section>
		</InternalDetailCard>
	)
}
