import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { MetricGrid, Panel } from "@/components/ui/layout";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

export function MerchantHome({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<div className="grid gap-5">
			<MetricGrid metrics={snapshot.metrics} />

			<div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
				<Panel
					description="These signals are derived from the actual Convex tables in this repository."
					title="Actual backend state"
				>
					<div className="space-y-3">
						{snapshot.signals.map((signal) => (
							<article
								className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4"
								key={signal.label}
							>
								<div className="flex items-center justify-between gap-3">
									<p className="font-semibold text-slate-900">{signal.label}</p>
									<StatusPill tone={signal.tone}>{signal.tone}</StatusPill>
								</div>
								<p className="mt-2 text-sm leading-6 text-slate-600">{signal.detail}</p>
							</article>
						))}
					</div>
				</Panel>

				<Panel
					description="These are the real blockers keeping the merchant app from being meaningfully connected to Shopify."
					title="Connection blockers"
				>
					{snapshot.blockers.length > 0 ? (
						<ul className="space-y-3">
							{snapshot.blockers.map((blocker) => (
								<li
									className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900"
									key={blocker}
								>
									{blocker}
								</li>
							))}
						</ul>
					) : (
						<EmptyState
							body="Convex has real records for the core installation, webhook, workflow, and audit surfaces."
							title="No connection blockers detected"
						/>
					)}
				</Panel>
			</div>
		</div>
	);
}
