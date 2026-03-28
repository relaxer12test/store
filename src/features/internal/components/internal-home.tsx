import { Strong, Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import { MetricGrid, Panel } from "@/components/ui/layout";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

export function InternalHome({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<div className="grid gap-5">
			<MetricGrid metrics={snapshot.metrics} />

			<div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
				<Panel description="Active alerts from system monitoring." title="Watchlist">
					{snapshot.signals.length > 0 ? (
						<div className="space-y-3">
							{snapshot.signals.map((signal) => (
								<article
									className="flex items-start justify-between gap-3 rounded-lg border border-zinc-950/6 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-800"
									key={signal.label}
								>
									<div className="min-w-0">
										<Strong>{signal.label}</Strong>
										<Text className="mt-1">{signal.detail}</Text>
									</div>
									<StatusPill tone={signal.tone}>{signal.tone}</StatusPill>
								</article>
							))}
						</div>
					) : (
						<Text>No active signals.</Text>
					)}
				</Panel>

				<Panel
					description="Issues that need attention."
					title="Current blockers"
				>
					{snapshot.blockers.length > 0 ? (
						<ul className="space-y-3">
							{snapshot.blockers.map((blocker) => (
								<li
									className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950"
									key={blocker}
								>
									<Text>{blocker}</Text>
								</li>
							))}
						</ul>
					) : (
						<Text>No blockers detected.</Text>
					)}
				</Panel>
			</div>
		</div>
	);
}
