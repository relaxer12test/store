import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { Button } from "@/components/ui/cata/button";
import { Subheading } from "@/components/ui/cata/heading";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/cata/table";
import { Strong, Text } from "@/components/ui/cata/text";
import { EmptyState, StatusPill } from "@/components/ui/feedback";
import type {
	DashboardSpec,
	MerchantApprovalCard,
	MerchantCitation,
	MerchantExplorerDataset,
	MerchantWorkflowRecord,
} from "@/shared/contracts/merchant-workspace";

type ExplorerRow = MerchantExplorerDataset["rows"][number];

const columnHelper = createColumnHelper<ExplorerRow>();

const cardFrameClass =
	"rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800";

function approvalTone(status: MerchantApprovalCard["status"]) {
	switch (status) {
		case "approved":
			return "success";
		case "executing":
		case "pending":
			return "watch";
		case "failed":
			return "blocked";
		case "rejected":
			return "neutral";
	}
}

function workflowTone(status: MerchantWorkflowRecord["status"]) {
	if (status === "completed") {
		return "success";
	}

	if (status === "failed") {
		return "blocked";
	}

	if (status === "running" || status === "pending") {
		return "watch";
	}

	return "neutral";
}

function workflowLogTone(level: MerchantWorkflowRecord["logs"][number]["level"]) {
	if (level === "success") {
		return "success";
	}

	if (level === "error") {
		return "blocked";
	}

	if (level === "watch") {
		return "watch";
	}

	return "neutral";
}

function formatLabel(key: string) {
	return key.replaceAll("_", " ");
}

function formatMaybeDate(value: string | null | undefined) {
	if (!value) {
		return "n/a";
	}

	const parsed = Date.parse(value);

	if (!Number.isFinite(parsed)) {
		return value;
	}

	return new Date(parsed).toLocaleString();
}

function renderCellValue(value: string | number | null) {
	if (value === null) {
		return "n/a";
	}

	return typeof value === "number" ? value.toLocaleString() : value;
}

function cardSpanClass(type: DashboardSpec["cards"][number]["type"]) {
	switch (type) {
		case "metric":
			return "xl:col-span-1";
		case "insight":
		case "bar_chart":
		case "line_chart":
			return "xl:col-span-2";
		case "table":
			return "xl:col-span-4";
	}
}

function buildLinePath(points: Array<{ label: string; value: number }>) {
	if (points.length === 0) {
		return "";
	}

	const maxValue = Math.max(...points.map((point) => point.value), 1);
	const minValue = Math.min(...points.map((point) => point.value), 0);
	const range = Math.max(maxValue - minValue, 1);

	return points
		.map((point, index) => {
			const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
			const y = 44 - ((point.value - minValue) / range) * 30;
			return `${x},${y}`;
		})
		.join(" ");
}

function DashboardCard({ card }: { card: DashboardSpec["cards"][number] }) {
	switch (card.type) {
		case "metric":
			return (
				<article className={cardFrameClass}>
					<div className="flex items-center justify-between gap-3">
						<Text>{card.valueLabel}</Text>
						<StatusPill tone={card.tone}>{card.tone}</StatusPill>
					</div>
					<p className="mt-4 font-serif text-4xl leading-none text-zinc-950 dark:text-white">
						{card.value}
					</p>
					<Text className="mt-3">{card.description}</Text>
				</article>
			);
		case "line_chart":
			return (
				<article className={cardFrameClass}>
					<div className="flex items-center justify-between gap-3">
						<Text>{card.seriesLabel}</Text>
						<StatusPill tone="accent">{card.type.replaceAll("_", " ")}</StatusPill>
					</div>
					<div className="mt-5">
						<svg className="h-32 w-full" preserveAspectRatio="none" viewBox="0 0 100 48">
							<path d="M0 44H100" fill="none" stroke="rgb(203 213 225)" strokeWidth="0.6" />
							<polyline
								fill="none"
								points={buildLinePath(card.points)}
								stroke="rgb(15 23 42)"
								strokeWidth="2"
							/>
						</svg>
						<div className="mt-3 grid grid-cols-4 gap-2 text-xs text-zinc-500 dark:text-zinc-400">
							{card.points.slice(-4).map((point) => (
								<div key={`${card.id}-${point.label}`}>
									<p className="font-semibold text-zinc-700 dark:text-zinc-300">{point.label}</p>
									<p>{point.value.toLocaleString()}</p>
								</div>
							))}
						</div>
					</div>
					<Text className="mt-4">{card.description}</Text>
				</article>
			);
		case "bar_chart": {
			const maxValue = Math.max(...card.points.map((point) => point.value), 1);

			return (
				<article className={cardFrameClass}>
					<div className="flex items-center justify-between gap-3">
						<Text>{card.seriesLabel}</Text>
						<StatusPill tone="accent">{card.type.replaceAll("_", " ")}</StatusPill>
					</div>
					<div className="mt-5 flex min-h-40 items-end gap-3">
						{card.points.map((point) => (
							<div
								className="flex flex-1 flex-col items-center gap-3"
								key={`${card.id}-${point.label}`}
							>
								<div
									className="w-full rounded-t-full bg-zinc-900/85 dark:bg-zinc-100/85"
									style={{
										height: `${Math.max((point.value / maxValue) * 8, 0.8)}rem`,
									}}
								/>
								<div className="text-center text-xs text-zinc-500 dark:text-zinc-400">
									<p className="font-semibold text-zinc-700 dark:text-zinc-300">{point.label}</p>
									<p>{point.value.toLocaleString()}</p>
								</div>
							</div>
						))}
					</div>
					<Text className="mt-4">{card.description}</Text>
				</article>
			);
		}
		case "table":
			return (
				<article className={cardFrameClass}>
					<div className="flex items-center justify-between gap-3">
						<Text>Structured table</Text>
						<StatusPill tone="neutral">{card.rows.length} rows</StatusPill>
					</div>
					<div className="mt-5">
						<Table>
							<TableHead>
								<TableRow>
									{card.columns.map((column) => (
										<TableHeader key={`${card.id}-${column}`}>{formatLabel(column)}</TableHeader>
									))}
								</TableRow>
							</TableHead>
							<TableBody>
								{card.rows.slice(0, 8).map((row, rowIndex) => (
									<TableRow key={`${card.id}-${rowIndex}`}>
										{card.columns.map((column) => (
											<TableCell key={column}>{renderCellValue(row[column] ?? null)}</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					<Text className="mt-4">{card.description}</Text>
				</article>
			);
		case "insight":
			return (
				<article className={cardFrameClass}>
					<div className="flex items-center justify-between gap-3">
						<Text>Operational insight</Text>
						<StatusPill tone={card.tone}>{card.tone}</StatusPill>
					</div>
					<ul className="mt-5 space-y-3">
						{card.bullets.map((bullet) => (
							<li
								className="rounded-lg border border-zinc-950/5 bg-white px-4 py-3 text-sm leading-6 text-zinc-900 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
								key={bullet}
							>
								{bullet}
							</li>
						))}
					</ul>
					<Text className="mt-4">{card.description}</Text>
				</article>
			);
	}
}

export function MerchantDashboard({ dashboard }: { dashboard: DashboardSpec }) {
	return (
		<div>
			<div className="flex flex-wrap items-center gap-3">
				<StatusPill tone="accent">{dashboard.title}</StatusPill>
				<StatusPill tone="neutral">{formatMaybeDate(dashboard.generatedAt)}</StatusPill>
			</div>
			<Text className="mt-4 max-w-3xl">{dashboard.description}</Text>
			<div className="mt-6 grid gap-4 xl:grid-cols-4">
				{dashboard.cards.map((card) => (
					<div className={cardSpanClass(card.type)} key={card.id}>
						<DashboardCard card={card} />
					</div>
				))}
			</div>
		</div>
	);
}

export function MerchantCitationList({ citations }: { citations: MerchantCitation[] }) {
	if (citations.length === 0) {
		return null;
	}

	function sourceLabel(sourceType: MerchantCitation["sourceType"]) {
		switch (sourceType) {
			case "approval":
				return "Approval";
			case "document":
				return "Document";
			case "workflow":
				return "Workflow";
			default:
				return "Shopify";
		}
	}

	return (
		<div className="mt-4 flex flex-wrap gap-2">
			{citations.map((citation) => (
				<div
					className="rounded-full border border-zinc-950/5 bg-zinc-100 px-3 py-1.5 text-xs leading-5 text-zinc-700 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300"
					key={`${citation.sourceType}-${citation.label}-${citation.detail}`}
				>
					<span className="mr-2 rounded-full bg-white px-2 py-0.5 font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
						{sourceLabel(citation.sourceType)}
					</span>
					<Strong>{citation.label}:</Strong> {citation.detail}
				</div>
			))}
		</div>
	);
}

export function MerchantApprovalCards({
	activeApprovalId,
	approvals,
	emptyBody,
	emptyTitle,
	onApprove,
	onReject,
}: {
	activeApprovalId?: string | null;
	approvals: MerchantApprovalCard[];
	emptyBody: string;
	emptyTitle: string;
	onApprove?: (approvalId: string) => void;
	onReject?: (approvalId: string) => void;
}) {
	if (approvals.length === 0) {
		return <EmptyState body={emptyBody} title={emptyTitle} />;
	}

	return (
		<div className="space-y-4">
			{approvals.map((approval) => {
				const isBusy = activeApprovalId === approval.id;

				return (
					<article className={cardFrameClass} key={approval.id}>
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div className="max-w-2xl">
								<Text>
									{approval.targetShopDomain} · {approval.targetType}
								</Text>
								<Subheading className="mt-2">{approval.summary}</Subheading>
								<Text className="mt-2">{approval.riskSummary}</Text>
							</div>
							<StatusPill tone={approvalTone(approval.status)}>{approval.status}</StatusPill>
						</div>

						<div className="mt-4 grid gap-3 md:grid-cols-2">
							<div className="rounded-lg border border-zinc-950/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
								<Text>Target</Text>
								<p className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
									{approval.targetLabel}
								</p>
								<Text className="mt-1">Tool: {approval.tool}</Text>
								<Text>Requested: {formatMaybeDate(approval.requestedAt)}</Text>
							</div>
							<div className="rounded-lg border border-zinc-950/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
								<Text>Planned changes</Text>
								<div className="mt-2 space-y-2">
									{approval.plannedChanges.map((change) => (
										<div
											className="rounded-lg border border-zinc-950/5 bg-zinc-50 px-3 py-2 text-sm leading-6 text-zinc-900 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100"
											key={`${approval.id}-${change.label}`}
										>
											<Strong>{change.label}</Strong>
											<Text>
												{change.before ?? "n/a"} → {change.after ?? "n/a"}
											</Text>
										</div>
									))}
								</div>
							</div>
						</div>

						{approval.resultSummary ? (
							<p className="mt-4 text-sm leading-6 text-emerald-800">{approval.resultSummary}</p>
						) : null}
						{approval.errorMessage ? (
							<p className="mt-4 text-sm leading-6 text-rose-700">{approval.errorMessage}</p>
						) : null}

						{approval.status === "pending" && (onApprove || onReject) ? (
							<div className="mt-5 flex flex-wrap gap-3">
								{onApprove ? (
									<Button
										color="dark/zinc"
										disabled={isBusy}
										onClick={() => onApprove(approval.id)}
										type="button"
									>
										{isBusy ? "Applying..." : "Approve and apply"}
									</Button>
								) : null}
								{onReject ? (
									<Button
										outline
										disabled={isBusy}
										onClick={() => onReject(approval.id)}
										type="button"
									>
										Reject
									</Button>
								) : null}
							</div>
						) : null}
					</article>
				);
			})}
		</div>
	);
}

export function MerchantWorkflowCards({
	emptyBody,
	emptyTitle,
	records,
}: {
	emptyBody: string;
	emptyTitle: string;
	records: MerchantWorkflowRecord[];
}) {
	if (records.length === 0) {
		return <EmptyState body={emptyBody} title={emptyTitle} />;
	}

	return (
		<div className="space-y-4">
			{records.map((record) => (
				<article className={cardFrameClass} key={record.id}>
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<Text>{record.type.replaceAll("_", " ")}</Text>
							<Subheading className="mt-2">{record.title}</Subheading>
						</div>
						<div className="flex flex-wrap gap-2">
							<StatusPill tone={workflowTone(record.status)}>{record.status}</StatusPill>
							{record.retryCount > 0 ? (
								<StatusPill tone="watch">retry {record.retryCount}</StatusPill>
							) : null}
						</div>
					</div>

					<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
						<div className="rounded-lg border border-zinc-950/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
							<Text>Requested</Text>
							<Text className="mt-2">{formatMaybeDate(record.requestedAt)}</Text>
						</div>
						<div className="rounded-lg border border-zinc-950/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
							<Text>Started</Text>
							<Text className="mt-2">{formatMaybeDate(record.startedAt)}</Text>
						</div>
						<div className="rounded-lg border border-zinc-950/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
							<Text>Completed</Text>
							<Text className="mt-2">{formatMaybeDate(record.completedAt)}</Text>
						</div>
						<div className="rounded-lg border border-zinc-950/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
							<Text>Retry at</Text>
							<Text className="mt-2">{formatMaybeDate(record.retryAt)}</Text>
						</div>
					</div>

					{record.payloadPreview ? <Text className="mt-4">{record.payloadPreview}</Text> : null}
					{record.resultSummary ? (
						<p className="mt-2 text-sm leading-6 text-emerald-800">{record.resultSummary}</p>
					) : null}
					{record.error ? (
						<p className="mt-2 text-sm leading-6 text-rose-700">{record.error}</p>
					) : null}

					<div className="mt-5 space-y-2">
						{record.logs.map((log) => (
							<div
								className="flex flex-col gap-2 rounded-lg border border-zinc-950/5 bg-white px-4 py-3 lg:flex-row lg:items-start lg:justify-between dark:border-white/10 dark:bg-zinc-900"
								key={`${record.id}-${log.createdAt}-${log.message}`}
							>
								<div>
									<Strong>{log.message}</Strong>
									{log.detail ? <Text className="mt-1">{log.detail}</Text> : null}
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<StatusPill tone={workflowLogTone(log.level)}>{log.level}</StatusPill>
									<StatusPill tone="neutral">{formatMaybeDate(log.createdAt)}</StatusPill>
								</div>
							</div>
						))}
					</div>
				</article>
			))}
		</div>
	);
}

export function buildExplorerColumns(rows: ExplorerRow[]): ColumnDef<ExplorerRow>[] {
	const keys = Object.keys(rows[0] ?? {});

	return keys.map((key) =>
		columnHelper.accessor((row) => row[key] as string | number | null, {
			cell: (info) => renderCellValue(info.getValue() ?? null),
			header: formatLabel(key),
			id: key,
		}),
	) as ColumnDef<ExplorerRow>[];
}
