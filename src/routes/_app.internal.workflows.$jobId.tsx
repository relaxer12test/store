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
import {
	CodeValue,
	formatTimestampLabel,
	ResourceDetailPage,
	StatusValue,
} from "@/components/ui/resource";
import { getInternalWorkflowDetailQuery } from "@/features/internal/internal-admin-queries";

export const Route = createFileRoute("/_app/internal/workflows/$jobId")({
	loader: async ({ context, params }) => {
		await context.preload.ensureQueryData(getInternalWorkflowDetailQuery(params.jobId));
	},
	component: InternalWorkflowDetailRoute,
});

function InternalWorkflowDetailRoute() {
	const { jobId } = Route.useParams();
	const { data } = useSuspenseQuery(getInternalWorkflowDetailQuery(jobId));

	if (!data) {
		return (
			<ResourceDetailPage backHref="/internal/workflows" title="Workflow detail unavailable">
				<EmptyState body="The selected workflow could not be loaded." title="Unavailable" />
			</ResourceDetailPage>
		);
	}

	const { logs, record } = data;

	return (
		<ResourceDetailPage
			backHref="/internal/workflows"
			description={`${record.status}${record.source ? ` · ${record.source}` : ""}`}
			title={record.type}
		>
			<DescriptionList>
				<DescriptionTerm>Shop</DescriptionTerm>
				<DescriptionDetails>{record.shopName}</DescriptionDetails>
				<DescriptionTerm>Domain</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={record.domain} />
				</DescriptionDetails>
				<DescriptionTerm>Requested</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(record.requestedAt)}</DescriptionDetails>
				<DescriptionTerm>Started</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(record.startedAt)}</DescriptionDetails>
				<DescriptionTerm>Completed</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(record.completedAt)}</DescriptionDetails>
				<DescriptionTerm>Retry</DescriptionTerm>
				<DescriptionDetails>{String(record.retryCount)}</DescriptionDetails>
				<DescriptionTerm>Cache key</DescriptionTerm>
				<DescriptionDetails>{record.cacheKey ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Result summary</DescriptionTerm>
				<DescriptionDetails>{record.resultSummary ?? "n/a"}</DescriptionDetails>
				<DescriptionTerm>Error</DescriptionTerm>
				<DescriptionDetails>{record.error ?? "n/a"}</DescriptionDetails>
			</DescriptionList>

			<Panel title="Workflow log">
				{logs.length === 0 ? (
					<Text>No workflow logs were recorded for this job.</Text>
				) : (
					<ol className="space-y-3">
						{logs.map((log) => (
							<li
								className="rounded-lg border border-zinc-950/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
								key={`${log.createdAt}-${log.message}`}
							>
								<div className="flex flex-wrap items-center gap-2">
									<StatusValue value={log.level} />
									<Text className="text-xs text-zinc-500 dark:text-zinc-400">
										{formatTimestampLabel(log.createdAt)}
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
			</Panel>
		</ResourceDetailPage>
	);
}
