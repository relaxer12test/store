import { Strong, Text } from "@/components/ui/cata/text";
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
								className="rounded-lg border border-zinc-950/5 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800"
								key={signal.label}
							>
								<div className="flex items-center justify-between gap-3">
									<Strong>{signal.label}</Strong>
									<StatusPill tone={signal.tone}>{signal.tone}</StatusPill>
								</div>
								<Text className="mt-2">{signal.detail}</Text>
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
									className="rounded-lg border border-zinc-950/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-800"
									key={blocker}
								>
									<Text>{blocker}</Text>
								</li>
							))}
						</ul>
					) : (
						<Text>
							No backend blockers were detected from the current Convex tables.
						</Text>
					)}
				</Panel>
			</div>
		</div>
	);
}
