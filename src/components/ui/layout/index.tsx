import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Heading, Subheading } from "@/components/ui/cata/heading";
import { Text, Strong } from "@/components/ui/cata/text";
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
				<Text>{eyebrow}</Text>
				<Heading level={1}>{title}</Heading>
				<Text>{description}</Text>
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
			className={cn(
				"rounded-lg border border-zinc-950/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900",
				className,
			)}
		>
			<div className="mb-5">
				<Subheading>{title}</Subheading>
				{description ? <Text>{description}</Text> : null}
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
					className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800"
					key={metric.label}
				>
					<div className="flex items-center justify-between gap-3">
						<Text>{metric.label}</Text>
						<StatusPill tone={metric.tone}>{metric.delta}</StatusPill>
					</div>
					<Heading level={2} className="mt-5">
						{metric.value}
					</Heading>
					<Text>{metric.hint}</Text>
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
					className="grid gap-2 rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800 md:grid-cols-[1fr_auto]"
					key={`${item.title}-${item.meta}`}
				>
					<div>
						<Strong>{item.title}</Strong>
						<Text>{item.detail}</Text>
					</div>
					<Text>{item.meta}</Text>
				</li>
			))}
		</ol>
	);
}

export function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<DescriptionList>
			<DescriptionTerm>{label}</DescriptionTerm>
			<DescriptionDetails>{value}</DescriptionDetails>
		</DescriptionList>
	);
}
