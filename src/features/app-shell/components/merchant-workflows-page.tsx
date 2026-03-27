import { Heading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";
import { Panel } from "@/components/ui/layout";
import { MerchantWorkflowCards } from "@/features/app-shell/components/merchant-workspace-ui";
import type { MerchantWorkflowsData } from "@/shared/contracts/merchant-workspace";

function WorkflowSummaryCard({ label, value }: { label: string; value: number }) {
	return (
		<article className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800">
			<Text className="text-xs font-semibold uppercase tracking-[0.22em]">{label}</Text>
			<Heading level={2} className="mt-4">
				{value}
			</Heading>
		</article>
	);
}

export function MerchantWorkflowsPage({ data }: { data: MerchantWorkflowsData }) {
	const completedCount = data.records.filter((record) => record.status === "completed").length;
	const runningCount = data.records.filter(
		(record) => record.status === "running" || record.status === "pending",
	).length;
	const failedCount = data.records.filter((record) => record.status === "failed").length;

	return (
		<div className="grid gap-5">
			<div className="grid gap-4 md:grid-cols-3">
				<WorkflowSummaryCard label="Completed" value={completedCount} />
				<WorkflowSummaryCard label="Queued or running" value={runningCount} />
				<WorkflowSummaryCard label="Failed" value={failedCount} />
			</div>

			<Panel
				description="Convex workflow rows expose retry state, result summaries, and step-by-step logs so merchants can see why background work succeeded, retried, or failed."
				title="Workflow activity"
			>
				<MerchantWorkflowCards
					emptyBody="No merchant workflows have been queued yet."
					emptyTitle="No workflows"
					records={data.records}
				/>
			</Panel>
		</div>
	);
}
