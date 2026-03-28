import { useEffect, useState } from "react";
import { Button } from "@/components/ui/cata/button";
import { Subheading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Select } from "@/components/ui/cata/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/cata/table";
import { Text } from "@/components/ui/cata/text";
import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { getStatusTone } from "@/components/ui/resource";
import type {
	MerchantExplorerDatasetKey,
	MerchantExplorerPageData,
} from "@/shared/contracts/merchant-workspace";

const merchantExplorerTabs: Array<{
	key: MerchantExplorerDatasetKey;
	label: string;
}> = [
	{ key: "products", label: "Products" },
	{ key: "orders", label: "Orders" },
	{ key: "inventory", label: "Inventory" },
	{ key: "documents", label: "Documents" },
	{ key: "audit_logs", label: "Audit log" },
];

function formatLabel(value: string) {
	return value.replaceAll("_", " ");
}

function formatCellValue(key: string, value: string | number | null) {
	if (value === null) {
		return "n/a";
	}

	if (
		key.includes("status") ||
		key === "availability" ||
		key === "tracked" ||
		key === "visibility"
	) {
		return <StatusPill tone={getStatusTone(String(value))}>{String(value)}</StatusPill>;
	}

	return typeof value === "number" ? value.toLocaleString() : value;
}

function renderPreviewValue(value: unknown) {
	if (value === null || value === undefined || value === "") {
		return "n/a";
	}

	if (typeof value === "number") {
		return value.toLocaleString();
	}

	if (typeof value === "string") {
		return value;
	}

	return JSON.stringify(value);
}

function getRowId(row: Record<string, string | number | null>, fallback: string) {
	return String(row.handle ?? row.order ?? row.title ?? row.action ?? fallback);
}

function ExplorerTableSkeleton() {
	return (
		<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
			<div className="overflow-hidden rounded-lg border border-zinc-950/5 dark:border-white/10">
				<div className="space-y-3 p-5">
					{Array.from({ length: 6 }, (_, index) => (
						<div
							className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
							key={index}
						/>
					))}
				</div>
			</div>
			<div className="space-y-3 rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800">
				{Array.from({ length: 4 }, (_, index) => (
					<div className="h-16 animate-pulse rounded-lg bg-white dark:bg-zinc-900" key={index} />
				))}
			</div>
		</div>
	);
}

function ProductsSyncCard({
	isRefreshing,
	onRefresh,
	syncState,
}: {
	isRefreshing: boolean;
	onRefresh: (() => void) | null;
	syncState: NonNullable<MerchantExplorerPageData["syncState"]>;
}) {
	return (
		<div className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<Text className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
						Sync state
					</Text>
					<div className="mt-3 flex flex-wrap gap-2">
						<StatusPill tone={getStatusTone(syncState.status)}>{syncState.status}</StatusPill>
						<StatusPill tone={syncState.isStale ? "watch" : "success"}>
							{syncState.isStale ? "stale" : "fresh"}
						</StatusPill>
						<StatusPill tone="neutral">
							{syncState.recordCount !== null
								? `${syncState.recordCount.toLocaleString()} cached rows`
								: "snapshot pending"}
						</StatusPill>
					</div>
				</div>
				{onRefresh ? (
					<Button color="dark/zinc" disabled={isRefreshing} onClick={onRefresh} type="button">
						{isRefreshing ? "Queueing..." : "Refresh from Shopify"}
					</Button>
				) : null}
			</div>
			<div className="mt-4 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300 md:grid-cols-2">
				<Text>Last completed: {syncState.lastCompletedAt ?? "n/a"}</Text>
				<Text>Last requested: {syncState.lastRequestedAt ?? "n/a"}</Text>
				<Text>Last webhook: {syncState.lastWebhookAt ?? "n/a"}</Text>
				<Text>Queued or running jobs: {syncState.activeJobCount.toLocaleString()}</Text>
			</div>
			{syncState.pendingReason ? (
				<Text className="mt-3">Reason: {syncState.pendingReason}</Text>
			) : null}
			{syncState.staleWarning ? (
				<div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
					{syncState.staleWarning}
				</div>
			) : null}
			{syncState.lastError ? (
				<div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
					{syncState.lastError}
				</div>
			) : null}
		</div>
	);
}

export function MerchantExplorerPage({
	activeDatasetKey,
	currentPage,
	data,
	errorMessage,
	isFetching,
	isLoading,
	isRefreshingProducts,
	onDatasetChange,
	onNextPage,
	onPreviousPage,
	onRefreshProducts,
	onRetry,
	onSearchChange,
	onStatusChange,
	onVisibilityChange,
	searchValue,
	statusValue,
	visibilityValue,
}: {
	activeDatasetKey: MerchantExplorerDatasetKey;
	currentPage: number;
	data: MerchantExplorerPageData | undefined;
	errorMessage: string | null;
	isFetching: boolean;
	isLoading: boolean;
	isRefreshingProducts: boolean;
	onDatasetChange: (dataset: MerchantExplorerDatasetKey) => void;
	onNextPage: (() => void) | null;
	onPreviousPage: (() => void) | null;
	onRefreshProducts: (() => void) | null;
	onRetry: () => void;
	onSearchChange: ((value: string) => void) | null;
	onStatusChange: ((value: string) => void) | null;
	onVisibilityChange: ((value: string) => void) | null;
	searchValue: string;
	statusValue: string | undefined;
	visibilityValue: string | undefined;
}) {
	const rows = data?.rows ?? [];
	const keys = Object.keys(rows[0] ?? {});
	const hasActiveFilters = Boolean(
		searchValue ||
		(statusValue && statusValue !== "all") ||
		(visibilityValue && visibilityValue !== "all"),
	);
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
	const selectedRow = rows.find((row, index) => getRowId(row, `row-${index}`) === selectedRowId);
	const fallbackSelectedRow = selectedRow ?? rows[0] ?? null;
	const activeRowId = fallbackSelectedRow ? getRowId(fallbackSelectedRow, "selected") : null;

	useEffect(() => {
		if (!rows[0]) {
			setSelectedRowId(null);
			return;
		}

		const nextRowId = getRowId(rows[0], "row-0");
		const stillExists = rows.some((row, index) => getRowId(row, `row-${index}`) === selectedRowId);

		if (!stillExists) {
			setSelectedRowId(nextRowId);
		}
	}, [rows, selectedRowId]);

	return (
		<div className="grid gap-4">
			<Panel
				description="Explorer now reads each dataset from its real source, exposes sync state, and paginates on the server so merchants never search only a partial page by accident."
				title="Explorer datasets"
			>
				<div className="flex flex-wrap gap-3">
					{merchantExplorerTabs.map((dataset) => (
						<Button
							key={dataset.key}
							{...(dataset.key === activeDatasetKey
								? { color: "dark/zinc" as const }
								: { outline: true as const })}
							onClick={() => onDatasetChange(dataset.key)}
							type="button"
						>
							{dataset.label}
						</Button>
					))}
				</div>
			</Panel>

			<section className="rounded-lg border border-zinc-950/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div>
							<Subheading className="font-serif text-2xl">
								{data?.summary.title ??
									merchantExplorerTabs.find((tab) => tab.key === activeDatasetKey)?.label}
							</Subheading>
							<Text className="mt-2 max-w-3xl">
								{data?.summary.description ??
									"Browse the current merchant dataset without hidden caps or client-only filtering."}
							</Text>
							<div className="mt-3 flex flex-wrap gap-2">
								{data?.source ? <StatusPill tone="neutral">{data.source.label}</StatusPill> : null}
								{data?.summary.resultLabel ? (
									<StatusPill tone="accent">{data.summary.resultLabel}</StatusPill>
								) : null}
								{isFetching && !isLoading ? <StatusPill tone="watch">Refreshing</StatusPill> : null}
							</div>
						</div>

						<div className="flex flex-wrap gap-3">
							{onSearchChange ? (
								<Input
									className="min-w-60"
									onChange={(event) => onSearchChange(event.target.value)}
									placeholder="Search rows"
									value={searchValue}
								/>
							) : null}
							{onStatusChange ? (
								<Select
									onChange={(event) => onStatusChange(event.target.value)}
									value={statusValue ?? "all"}
								>
									{activeDatasetKey === "products" ? (
										<>
											<option value="all">All statuses</option>
											<option value="active">Active</option>
											<option value="draft">Draft</option>
											<option value="archived">Archived</option>
										</>
									) : (
										<>
											<option value="all">All statuses</option>
											<option value="ready">Ready</option>
											<option value="processing">Processing</option>
											<option value="failed">Failed</option>
										</>
									)}
								</Select>
							) : null}
							{onVisibilityChange ? (
								<Select
									onChange={(event) => onVisibilityChange(event.target.value)}
									value={visibilityValue ?? "all"}
								>
									<option value="all">All visibility</option>
									<option value="public">Public</option>
									<option value="shop_private">Shop private</option>
								</Select>
							) : null}
						</div>
					</div>

					{activeDatasetKey === "products" && data?.syncState ? (
						<ProductsSyncCard
							isRefreshing={isRefreshingProducts}
							onRefresh={onRefreshProducts}
							syncState={data.syncState}
						/>
					) : null}

					{errorMessage ? (
						<div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-900">
							<Subheading>Explorer load failed</Subheading>
							<Text className="mt-2">{errorMessage}</Text>
							<div className="mt-4">
								<Button color="dark/zinc" onClick={onRetry} type="button">
									Retry
								</Button>
							</div>
						</div>
					) : isLoading ? (
						<ExplorerTableSkeleton />
					) : rows.length === 0 ? (
						<EmptyState
							body={
								activeDatasetKey === "products" && data?.syncState && !data.syncState.hasSnapshot
									? "Explorer queued a Shopify sync for the merchant catalog. Keep this page open or refresh after the workflow finishes."
									: hasActiveFilters
										? "No rows matched the current filters."
										: `No ${data?.summary.title.toLowerCase() ?? "rows"} are available yet.`
							}
							title={
								activeDatasetKey === "products" && data?.syncState && !data.syncState.hasSnapshot
									? "Catalog sync in progress"
									: hasActiveFilters
										? "No matching rows"
										: `No ${data?.summary.title.toLowerCase() ?? "rows"}`
							}
						/>
					) : (
						<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
							<div className="overflow-hidden rounded-lg border border-zinc-950/5 dark:border-white/10">
								<Table dense>
									<TableHead>
										<TableRow>
											{keys.map((key) => (
												<TableHeader
													className="text-[0.68rem] font-semibold uppercase tracking-[0.22em]"
													key={key}
												>
													{formatLabel(key)}
												</TableHeader>
											))}
										</TableRow>
									</TableHead>
									<TableBody>
										{rows.map((row, index) => {
											const rowId = getRowId(row, `row-${index}`);
											const isSelected = activeRowId === rowId;

											return (
												<TableRow
													className={`cursor-pointer transition ${
														isSelected ? "bg-zinc-100 dark:bg-zinc-800" : ""
													}`}
													key={rowId}
													onClick={() => setSelectedRowId(rowId)}
												>
													{keys.map((key) => (
														<TableCell
															className="align-top text-sm leading-6"
															key={`${rowId}-${key}`}
														>
															{formatCellValue(key, (row[key] as string | number | null) ?? null)}
														</TableCell>
													))}
												</TableRow>
											);
										})}
									</TableBody>
								</Table>

								<div className="flex flex-col gap-4 border-t border-zinc-950/5 px-5 py-4 dark:border-white/10 lg:flex-row lg:items-center lg:justify-between">
									<Text className="text-sm text-zinc-600 dark:text-zinc-300">
										Page {currentPage.toLocaleString()}
									</Text>
									<div className="flex gap-2">
										<Button
											disabled={!onPreviousPage}
											onClick={onPreviousPage ?? undefined}
											outline
											type="button"
										>
											Previous page
										</Button>
										<Button
											color="dark/zinc"
											disabled={!onNextPage}
											onClick={onNextPage ?? undefined}
											type="button"
										>
											Next page
										</Button>
									</div>
								</div>
							</div>

							<aside className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800">
								<div className="flex items-center justify-between gap-3">
									<Text className="font-semibold">Row drill-in</Text>
									<StatusPill tone="neutral">
										{fallbackSelectedRow ? "selected" : "empty"}
									</StatusPill>
								</div>

								{fallbackSelectedRow ? (
									<div className="mt-4 space-y-3">
										{Object.entries(fallbackSelectedRow).map(([key, value]) => (
											<div
												className="rounded-lg border border-zinc-950/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
												key={key}
											>
												<p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
													{formatLabel(key)}
												</p>
												<p className="mt-2 text-sm leading-6 text-zinc-950 dark:text-white">
													{renderPreviewValue(value)}
												</p>
											</div>
										))}
									</div>
								) : (
									<div className="mt-4">
										<EmptyState
											body="Select a row to inspect its full field set."
											title="No row selected"
										/>
									</div>
								)}
							</aside>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
