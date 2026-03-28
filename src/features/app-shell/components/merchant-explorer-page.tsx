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

function getVisibleKeys(row: Record<string, string | number | null> | undefined) {
	return Object.keys(row ?? {}).filter((key) => !key.startsWith("_"));
}

function getRowId(row: Record<string, string | number | null>, fallback: string) {
	return String(row._row_id ?? row.handle ?? row.order ?? row.title ?? row.action ?? fallback);
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

function ExplorerTableSkeleton() {
	return (
		<div className="space-y-3 rounded-lg border border-zinc-950/5 p-5 dark:border-white/10">
			{Array.from({ length: 8 }, (_, index) => (
				<div className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" key={index} />
			))}
		</div>
	);
}

function buildPageItems(currentPage: number, hasNextPage: boolean) {
	const items = Array.from({ length: currentPage }, (_, index) => index + 1);

	if (hasNextPage) {
		items.push(currentPage + 1);
	}

	return items;
}

export function MerchantExplorerPage({
	activeDatasetKey,
	currentPage,
	data,
	errorMessage,
	getRowHref,
	isFetching,
	isLoading,
	onDatasetChange,
	onFirstPage,
	onGoToPage,
	onNextPage,
	onPreviousPage,
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
	getRowHref: (row: Record<string, string | number | null>) => string | null;
	isFetching: boolean;
	isLoading: boolean;
	onDatasetChange: (dataset: MerchantExplorerDatasetKey) => void;
	onFirstPage: (() => void) | null;
	onGoToPage: ((page: number) => void) | null;
	onNextPage: (() => void) | null;
	onPreviousPage: (() => void) | null;
	onRetry: () => void;
	onSearchChange: ((value: string) => void) | null;
	onStatusChange: ((value: string) => void) | null;
	onVisibilityChange: ((value: string) => void) | null;
	searchValue: string;
	statusValue: string | undefined;
	visibilityValue: string | undefined;
}) {
	const rows = data?.rows ?? [];
	const keys = getVisibleKeys(rows[0]);
	const hasNextPage = Boolean(data?.pageInfo.continueCursor);
	const pageItems = buildPageItems(currentPage, hasNextPage);
	const productSync = activeDatasetKey === "products" ? (data?.syncState ?? null) : null;
	const hasActiveFilters = Boolean(
		searchValue ||
		(statusValue && statusValue !== "all") ||
		(visibilityValue && visibilityValue !== "all"),
	);

	return (
		<div className="grid gap-4">
			<Panel
				description="Explorer now uses dedicated detail pages, server-driven pagination, and real source-backed reads so merchants can browse large datasets without hidden caps."
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

			<section className="rounded-lg border border-zinc-950/5 bg-white p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-zinc-900">
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
						<div>
							<Subheading className="font-serif text-2xl">
								{data?.summary.title ??
									merchantExplorerTabs.find((tab) => tab.key === activeDatasetKey)?.label}
							</Subheading>
							<Text className="mt-2 max-w-3xl">
								{data?.summary.description ??
									"Browse the current merchant dataset without hidden caps or side-panel drill-ins."}
							</Text>
							<div className="mt-3 flex flex-wrap gap-2">
								{data?.source ? <StatusPill tone="neutral">{data.source.label}</StatusPill> : null}
								{data?.summary.resultLabel ? (
									<StatusPill tone="accent">{data.summary.resultLabel}</StatusPill>
								) : null}
								{productSync && productSync.workflowStatus !== "missing" ? (
									<StatusPill tone={getStatusTone(productSync.workflowStatus)}>
										workflow {productSync.workflowStatus}
									</StatusPill>
								) : null}
								{productSync && productSync.recordCount !== null ? (
									<StatusPill tone="neutral">
										{productSync.recordCount.toLocaleString()} cached rows
									</StatusPill>
								) : null}
								{isFetching && !isLoading ? <StatusPill tone="watch">Refreshing</StatusPill> : null}
							</div>
							{productSync?.progressMessage ? (
								<Text className="mt-3 max-w-3xl text-sm text-zinc-600 dark:text-zinc-300">
									{productSync.progressMessage}
								</Text>
							) : null}
							{productSync?.lastError ? (
								<div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
									{productSync.lastError}
								</div>
							) : null}
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
									? "Explorer queued a Shopify workflow for the merchant catalog. This page will update as progress lands."
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
										const href = getRowHref(row);

										return (
											<TableRow href={href ?? undefined} key={rowId} title={`Open ${rowId}`}>
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
								<div className="flex flex-wrap items-center gap-3">
									<Text className="text-sm text-zinc-600 dark:text-zinc-300">
										Page {currentPage.toLocaleString()}
									</Text>
									<Text className="text-sm text-zinc-500 dark:text-zinc-400">
										{rows.length.toLocaleString()} row{rows.length === 1 ? "" : "s"} on this page
									</Text>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Button
										disabled={!onFirstPage}
										onClick={onFirstPage ?? undefined}
										outline
										type="button"
									>
										First page
									</Button>
									<Button
										disabled={!onPreviousPage}
										onClick={onPreviousPage ?? undefined}
										outline
										type="button"
									>
										Newer
									</Button>
									<div className="flex flex-wrap gap-2">
										{pageItems.map((page) => {
											const isCurrent = page === currentPage;
											const isNextPage = page === currentPage + 1 && hasNextPage;

											return (
												<Button
													key={page}
													{...(isCurrent
														? { color: "dark/zinc" as const }
														: { outline: true as const })}
													disabled={isCurrent || (page > currentPage && !isNextPage)}
													onClick={() => {
														if (isNextPage) {
															onNextPage?.();
															return;
														}

														onGoToPage?.(page);
													}}
													type="button"
												>
													{page}
												</Button>
											);
										})}
									</div>
									<Button
										color="dark/zinc"
										disabled={!onNextPage}
										onClick={onNextPage ?? undefined}
										type="button"
									>
										Older
									</Button>
								</div>
							</div>
						</div>
					)}
				</div>
			</section>
		</div>
	);
}
