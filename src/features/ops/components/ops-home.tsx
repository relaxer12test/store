import { StatusPill } from "@/components/ui/feedback";
import { MetricGrid, Panel, TimelineList } from "@/components/ui/layout";
import type { OpsOverviewSnapshot } from "@/shared/contracts/app-shell";

export function OpsHome({ snapshot }: { snapshot: OpsOverviewSnapshot }) {
	return (
		<div className="grid gap-5">
			<MetricGrid metrics={snapshot.metrics} />
			<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
				<Panel
					description="Platform-only signals for tenants, sync health, and AI governance. These are wired behind a role-checked `/ops` layout."
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
					description="Representative operations work that later plans will back with real audit logs, sync jobs, and webhook delivery data."
					title="Internal queue"
				>
					<TimelineList items={snapshot.timeline} />
				</Panel>
			</div>
		</div>
	);
}
