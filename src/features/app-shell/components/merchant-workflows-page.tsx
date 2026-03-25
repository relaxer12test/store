import { Panel } from "@/components/ui/layout";
import { MerchantWorkflowCards } from "@/features/app-shell/components/merchant-workspace-ui";
import type { MerchantWorkflowsData } from "@/shared/contracts/merchant-workspace";

function WorkflowSummaryCard({ label, value }: { label: string; value: number }) {
	return (
		<article className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-5">
			<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
			<p className="mt-4 font-serif text-4xl leading-none text-slate-950">{value}</p>
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
