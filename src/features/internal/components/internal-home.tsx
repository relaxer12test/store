import { StatusPill } from "@/components/ui/feedback";
import { MetricGrid, Panel, TimelineList } from "@/components/ui/layout";
import type { InternalOverviewSnapshot } from "@/shared/contracts/app-shell";

export function InternalHome({ snapshot }: { snapshot: InternalOverviewSnapshot }) {
	return (
		<div className="grid gap-5">
			<MetricGrid metrics={snapshot.metrics} />
			<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
				<Panel
					description="Disposable diagnostics for install state, webhook posture, cache projections, and action traces. This console stays separate from merchant navigation and merchant auth assumptions."
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
					description="Representative debugging work that later plans will back with real install records, replay helpers, and action audit trails."
					title="Debug queue"
				>
					<TimelineList items={snapshot.timeline} />
				</Panel>
			</div>
		</div>
	);
}
