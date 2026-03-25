import { StatusPill } from "@/components/ui/feedback";
import { MetricGrid, Panel, TimelineList } from "@/components/ui/layout";
import type { MerchantOverviewSnapshot } from "@/shared/contracts/app-shell";

export function MerchantHome({ snapshot }: { snapshot: MerchantOverviewSnapshot }) {
	return (
		<div className="grid gap-5">
			<MetricGrid metrics={snapshot.metrics} />

			<div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
				<Panel
					description="Operational signals rendered from a Convex query. These are the above-the-fold facts we want SSR-loaded so the merchant overview never flashes."
					title="Runway"
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
					description="Representative merchant tasks that later plans will back with real warehouse metrics, workflows, and audit records."
					title="Next actions"
				>
					<TimelineList items={snapshot.timeline} />
				</Panel>
			</div>
		</div>
	);
}
