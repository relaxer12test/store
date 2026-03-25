import { Link } from "@tanstack/react-router";
import { StatusPill } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import type { MetricCard, TimelineItem } from "@/shared/contracts/app-shell";

export function PageHeader({
	actions,
	description,
	eyebrow,
	title,
}: {
	actions?: React.ReactNode;
	description: string;
	eyebrow: string;
	title: string;
}) {
	return (
		<header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
			<div className="max-w-3xl">
				<p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
					{eyebrow}
				</p>
				<h1 className="mt-3 font-serif text-4xl leading-none text-slate-950 sm:text-5xl">
					{title}
				</h1>
				<p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
			</div>
			{actions ? <div className="flex items-center gap-3">{actions}</div> : null}
		</header>
	);
}

export function Panel({
	children,
	className,
	description,
	title,
}: {
	children: React.ReactNode;
	className?: string;
	description?: string;
	title: string;
}) {
	return (
		<section
			className={cn("rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm", className)}
		>
			<div className="mb-5">
				<h2 className="font-serif text-2xl text-slate-950">{title}</h2>
				{description ? (
					<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
				) : null}
			</div>
			{children}
		</section>
	);
}

export function MetricGrid({ metrics }: { metrics: MetricCard[] }) {
	return (
		<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			{metrics.map((metric) => (
				<article
					className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-5"
					key={metric.label}
				>
					<div className="flex items-center justify-between gap-3">
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
							{metric.label}
						</p>
						<StatusPill tone={metric.tone}>{metric.delta}</StatusPill>
					</div>
					<p className="mt-5 font-serif text-4xl leading-none text-slate-950">{metric.value}</p>
					<p className="mt-3 text-sm leading-6 text-slate-600">{metric.hint}</p>
				</article>
			))}
		</div>
	);
}

export function TimelineList({ items }: { items: TimelineItem[] }) {
	return (
		<ol className="space-y-4">
			{items.map((item) => (
				<li
					className="grid gap-2 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto]"
					key={`${item.title}-${item.meta}`}
				>
					<div>
						<p className="font-semibold text-slate-900">{item.title}</p>
						<p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
					</div>
					<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
						{item.meta}
					</p>
				</li>
			))}
		</ol>
	);
}

export interface SurfaceNavItem {
	description: string;
	title: string;
	to: string;
}

export function SurfaceNav({ items, label }: { items: SurfaceNavItem[]; label: string }) {
	return (
		<nav aria-label={label} className="flex flex-wrap gap-3">
			{items.map((item) => (
				<Link
					activeProps={{
						className: "border-slate-300 bg-slate-100",
					}}
					className="min-w-[13rem] rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300"
					key={item.to}
					to={item.to}
				>
					<p className="text-sm font-semibold text-slate-900">{item.title}</p>
					<p className="mt-1 text-xs leading-5 text-slate-600">{item.description}</p>
				</Link>
			))}
		</nav>
	);
}
