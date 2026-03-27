import { Button } from "@/components/ui/cata/button";
import { Strong, Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import { MetricGrid, Panel } from "@/components/ui/layout";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

const quickLinks = [
	{
		description: "Operator view over connected shops and install posture.",
		href: "/internal/shops",
		label: "Shops",
	},
	{
		description: "Projection freshness, stale windows, and cache failures.",
		href: "/internal/cache",
		label: "Cache",
	},
	{
		description: "Queue state, retries, and per-job log timelines.",
		href: "/internal/workflows",
		label: "Workflows",
	},
	{
		description: "Inbound delivery stream with payload previews.",
		href: "/internal/webhooks",
		label: "Webhooks",
	},
	{
		description: "Audit rows and approval side-effects.",
		href: "/internal/audits",
		label: "Audits",
	},
	{
		description: "Real-time shopper sessions and transcript drill-in.",
		href: "/internal/ai-sessions",
		label: "AI sessions",
	},
	{
		description: "Better Auth users, roles, and org membership.",
		href: "/internal/users",
		label: "Users",
	},
];

export function InternalHome({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<div className="grid gap-5">
			<MetricGrid metrics={snapshot.metrics} />

			<Panel
				description="Each route below is now a dedicated module with its own list state, pagination, and detail view."
				title="Routes"
			>
				<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
					{quickLinks.map((item) => (
						<article
							className="rounded-[1.6rem] border border-zinc-950/6 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800"
							key={item.href}
						>
							<Strong>{item.label}</Strong>
							<Text className="mt-2">{item.description}</Text>
							<div className="mt-4">
								<Button href={item.href} outline>
									Open route
								</Button>
							</div>
						</article>
					))}
				</div>
			</Panel>

			<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
				<Panel
					description="Signals are derived from live Convex state instead of static fixtures."
					title="Watchlist"
				>
					<div className="space-y-3">
						{snapshot.signals.map((signal) => (
							<article
								className="rounded-[1.6rem] border border-zinc-950/6 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800"
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
					description="Overview blockers stay here; deeper diagnosis now lives in the dedicated module routes."
					title="Current blockers"
				>
					{snapshot.blockers.length > 0 ? (
						<ul className="space-y-3">
							{snapshot.blockers.map((blocker) => (
								<li
									className="rounded-[1.6rem] border border-zinc-950/6 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-800"
									key={blocker}
								>
									<Text>{blocker}</Text>
								</li>
							))}
						</ul>
					) : (
						<Text>No backend blockers were detected from the current Convex tables.</Text>
					)}
				</Panel>
			</div>
		</div>
	);
}
