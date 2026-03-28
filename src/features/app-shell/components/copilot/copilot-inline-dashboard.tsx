import { Subheading } from "@/components/ui/cata/heading";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/cata/table";
import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import type { DashboardSpec } from "@/shared/contracts/merchant-workspace";

const cardClass =
	"rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/5 dark:bg-zinc-900";

function cardSpanClass(type: DashboardSpec["cards"][number]["type"]) {
	switch (type) {
		case "metric":
			return "sm:col-span-1";
		case "insight":
		case "bar_chart":
		case "line_chart":
			return "sm:col-span-2";
		case "table":
			return "sm:col-span-2";
	}
}

function buildLinePath(points: Array<{ label: string; value: number }>) {
	if (points.length === 0) {
		return "";
	}

	const maxValue = Math.max(...points.map((p) => p.value), 1);
	const minValue = Math.min(...points.map((p) => p.value), 0);
	const range = Math.max(maxValue - minValue, 1);

	return points
		.map((point, index) => {
			const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
			const y = 44 - ((point.value - minValue) / range) * 30;
			return `${x},${y}`;
		})
		.join(" ");
}

function renderCellValue(value: string | number | null) {
	if (value === null) {
		return "n/a";
	}

	return typeof value === "number" ? value.toLocaleString() : value;
}

function formatLabel(key: string) {
	return key.replaceAll("_", " ");
}

function DashboardCard({ card }: { card: DashboardSpec["cards"][number] }) {
	switch (card.type) {
		case "metric":
			return (
				<article className={cardClass}>
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
							{card.valueLabel}
						</p>
						<StatusPill tone={card.tone}>{card.tone}</StatusPill>
					</div>
					<p className="mt-2 font-serif text-2xl leading-none text-zinc-950 dark:text-white">
						{card.value}
					</p>
					<p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
						{card.description}
					</p>
				</article>
			);
		case "line_chart":
			return (
				<article className={cardClass}>
					<p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{card.seriesLabel}</p>
					<div className="mt-3">
						<svg className="h-24 w-full" preserveAspectRatio="none" viewBox="0 0 100 48">
							<path d="M0 44H100" fill="none" stroke="rgb(203 213 225)" strokeWidth="0.6" />
							<polyline
								fill="none"
								points={buildLinePath(card.points)}
								stroke="rgb(99 102 241)"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
						<div className="mt-2 grid grid-cols-4 gap-1 text-[0.65rem] text-zinc-500 dark:text-zinc-400">
							{card.points.slice(-4).map((point) => (
								<div key={`${card.id}-${point.label}`}>
									<p className="font-medium text-zinc-700 dark:text-zinc-300">{point.label}</p>
									<p>{point.value.toLocaleString()}</p>
								</div>
							))}
						</div>
					</div>
					<p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
						{card.description}
					</p>
				</article>
			);
		case "bar_chart": {
			const maxValue = Math.max(...card.points.map((p) => p.value), 1);

			return (
				<article className={cardClass}>
					<p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{card.seriesLabel}</p>
					<div className="mt-3 flex min-h-28 items-end gap-2">
						{card.points.map((point) => (
							<div
								className="flex flex-1 flex-col items-center gap-1.5"
								key={`${card.id}-${point.label}`}
							>
								<div
									className="w-full rounded-t bg-indigo-500/80 dark:bg-indigo-400/80"
									style={{
										height: `${Math.max((point.value / maxValue) * 6, 0.5)}rem`,
									}}
								/>
								<div className="text-center text-[0.6rem] text-zinc-500 dark:text-zinc-400">
									<p className="font-medium text-zinc-700 dark:text-zinc-300">{point.label}</p>
									<p>{point.value.toLocaleString()}</p>
								</div>
							</div>
						))}
					</div>
					<p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
						{card.description}
					</p>
				</article>
			);
		}
		case "table":
			return (
				<article className={cardClass}>
					<p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
						{card.rows.length} rows
					</p>
					<div className="mt-2 overflow-x-auto">
						<Table>
							<TableHead>
								<TableRow>
									{card.columns.map((column) => (
										<TableHeader key={`${card.id}-${column}`}>{formatLabel(column)}</TableHeader>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{card.rows.slice(0, 5).map((row, rowIndex) => (
									<TableRow key={`${card.id}-${rowIndex}`}>
										{card.columns.map((column) => (
											<TableCell key={column}>{renderCellValue(row[column] ?? null)}</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
						{card.description}
					</p>
				</article>
			);
		case "insight":
			return (
				<article className={cardClass}>
					<div className="flex items-center justify-between gap-2">
						<p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Insight</p>
						<StatusPill tone={card.tone}>{card.tone}</StatusPill>
					</div>
					<ul className="mt-3 space-y-2">
						{card.bullets.map((bullet) => (
							<li
								className="rounded border border-zinc-950/5 bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-800 dark:border-white/5 dark:bg-zinc-800 dark:text-zinc-200"
								key={bullet}
							>
								{bullet}
							</li>
						))}
					</ul>
					<p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
						{card.description}
					</p>
				</article>
			);
	}
}

export function CopilotInlineDashboard({ dashboard }: { dashboard: DashboardSpec }) {
	return (
		<div className="mt-4">
			<Subheading className="text-sm">{dashboard.title}</Subheading>
			<Text className="mt-1 text-xs">{dashboard.description}</Text>
			<div className="mt-3 grid gap-3 sm:grid-cols-2">
				{dashboard.cards.map((card) => (
					<div className={cardSpanClass(card.type)} key={card.id}>
						<DashboardCard card={card} />
					</div>
				))}
			</div>
		</div>
	);
}
