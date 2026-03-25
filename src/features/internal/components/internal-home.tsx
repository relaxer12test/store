import { StatusPill } from "@/components/ui/feedback";
import { MetricGrid, Panel } from "@/components/ui/layout";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

export function InternalHome({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<div className="grid gap-5">
			<MetricGrid metrics={snapshot.metrics} />
			<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
				<Panel
					description="Real diagnostics derived from Convex tables as they exist right now."
					title="Watchlist"
				>
					<div className="space-y-3">
						{snapshot.signals.map((signal) => (
							<article
								className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4"
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
					description="These blockers come from the actual state of the backend, not a roadmap mock."
					title="Current blockers"
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
						<p className="text-sm leading-6 text-slate-600">
							No backend blockers were detected from the current Convex tables.
						</p>
					)}
				</Panel>
			</div>
		</div>
	);
}
