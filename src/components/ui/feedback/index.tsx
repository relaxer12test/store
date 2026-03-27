import { Subheading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";
import { cn } from "@/lib/cn";

const toneClasses = {
	accent: "border-blue-200 bg-blue-50 text-blue-900",
	blocked: "border-red-200 bg-red-50 text-red-900",
	neutral: "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300",
	success: "border-emerald-200 bg-emerald-50 text-emerald-900",
	watch: "border-amber-200 bg-amber-50 text-amber-900",
} as const;

export function StatusPill({
	children,
	className,
	tone = "neutral",
}: {
	children: React.ReactNode;
	className?: string;
	tone?: keyof typeof toneClasses;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em]",
				toneClasses[tone],
				className,
			)}
		>
			{children}
		</span>
	);
}

export function EmptyState({
	action,
	body,
	title,
}: {
	action?: React.ReactNode;
	body: string;
	title: string;
}) {
	return (
		<div className="rounded-lg border border-dashed border-zinc-950/10 bg-zinc-50 px-6 py-8 text-left dark:border-white/10 dark:bg-zinc-800">
			<Subheading>{title}</Subheading>
			<Text>{body}</Text>
			{action ? <div className="mt-5">{action}</div> : null}
		</div>
	);
}
