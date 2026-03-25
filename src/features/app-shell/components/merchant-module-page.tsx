import { StatusPill } from "@/components/ui/feedback";
import { Panel, TimelineList } from "@/components/ui/layout";
import type { ModuleSnapshot } from "@/shared/contracts/app-shell";

export function MerchantModulePage({ snapshot }: { snapshot: ModuleSnapshot }) {
	return (
		<div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
			<Panel description={snapshot.summary} title={snapshot.title}>
				<div className="flex flex-wrap gap-2">
					{snapshot.chips.map((chip) => (
						<StatusPill key={chip} tone="neutral">
							{chip}
						</StatusPill>
					))}
				</div>
				<div className="mt-6 space-y-3">
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
				description="Every module route keeps feature logic outside the route file and consumes the exact same query key that its loader preloaded."
				title="Execution timeline"
			>
				<TimelineList items={snapshot.timeline} />
			</Panel>
		</div>
	);
}
