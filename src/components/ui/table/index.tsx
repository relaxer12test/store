import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type PaginationState,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/cata/button";
import { Checkbox, CheckboxField } from "@/components/ui/cata/checkbox";
import { Label } from "@/components/ui/cata/fieldset";
import { Subheading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Pagination, PaginationGap, PaginationList } from "@/components/ui/cata/pagination";
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

interface DataTableShellProps<TData extends Record<string, unknown>> {
	columns: ColumnDef<TData>[];
	data: TData[];
	description?: string;
	emptyBody: string;
	emptyTitle: string;
	title: string;
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

function isFilterValue(value: unknown): value is string | number {
	return typeof value === "string" || typeof value === "number";
}

const EXPLORER_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function buildPaginationItems(pageCount: number, currentPage: number) {
	if (pageCount <= 7) {
		return Array.from({ length: pageCount }, (_, index) => index + 1);
	}

	const items: Array<number | null> = [1];
	const start = Math.max(2, currentPage - 1);
	const end = Math.min(pageCount - 1, currentPage + 1);

	if (start > 2) {
		items.push(null);
	}

	for (let page = start; page <= end; page += 1) {
		items.push(page);
	}

	if (end < pageCount - 1) {
		items.push(null);
	}

	items.push(pageCount);

	return items;
}

export function DataTableShell<TData extends Record<string, unknown>>({
	columns,
	data,
	description,
	emptyBody,
	emptyTitle,
	title,
}: DataTableShellProps<TData>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [filterColumnId, setFilterColumnId] = useState("");
	const [filterValue, setFilterValue] = useState("all");
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: EXPLORER_PAGE_SIZE_OPTIONS[0],
	});
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

	const table = useReactTable({
		columns,
		data,
		getCoreRowModel: getCoreRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		state: {
			columnFilters,
			columnVisibility,
			globalFilter,
			pagination,
			sorting,
		},
	});

	const filteredRows = table.getPrePaginationRowModel().rows;
	const paginatedRows = table.getRowModel().rows;
	const visibleColumns = table.getVisibleLeafColumns();
	const filterableColumns = table
		.getAllLeafColumns()
		.filter((column) => {
			const values = Array.from(column.getFacetedUniqueValues().keys()).filter(isFilterValue);
			return values.length > 0 && values.length <= 12;
		})
		.map((column) => ({
			column,
			values: Array.from(column.getFacetedUniqueValues().keys())
				.filter(isFilterValue)
				.map((value) => String(value))
				.sort((left, right) => left.localeCompare(right)),
		}));
	const activeFilterColumnId =
		filterableColumns.find((item) => item.column.id === filterColumnId)?.column.id ??
		filterableColumns[0]?.column.id ??
		"";
	const activeFilterValues =
		filterableColumns.find((item) => item.column.id === activeFilterColumnId)?.values ?? [];
	const pageCount = Math.max(table.getPageCount(), 1);
	const currentPage = Math.min(pagination.pageIndex, pageCount - 1) + 1;
	const paginationItems = buildPaginationItems(pageCount, currentPage);
	const selectedRow =
		paginatedRows.find((row) => row.id === selectedRowId) ?? paginatedRows[0] ?? null;
	const selectedRecord = (selectedRow?.original ?? null) as Record<string, unknown> | null;
	const selectedRowPosition = selectedRow
		? filteredRows.findIndex((row) => row.id === selectedRow.id) + 1
		: 0;
	const pageStart = paginatedRows.length === 0 ? 0 : (currentPage - 1) * pagination.pageSize + 1;
	const pageEnd = paginatedRows.length === 0 ? 0 : pageStart + paginatedRows.length - 1;

	useEffect(() => {
		if (activeFilterColumnId.length === 0) {
			if (columnFilters.length > 0) {
				setColumnFilters([]);
			}

			return;
		}

		if (filterValue === "all") {
			if (columnFilters.length > 0) {
				setColumnFilters([]);
			}

			return;
		}

		setColumnFilters((current) => {
			if (
				current.length === 1 &&
				current[0]?.id === activeFilterColumnId &&
				current[0]?.value === filterValue
			) {
				return current;
			}

			return [
				{
					id: activeFilterColumnId,
					value: filterValue,
				},
			];
		});
	}, [activeFilterColumnId, columnFilters.length, filterValue]);

	useEffect(() => {
		if (filterValue !== "all" && !activeFilterValues.includes(filterValue)) {
			setFilterValue("all");
		}
	}, [activeFilterValues, filterValue]);

	useEffect(() => {
		setPagination((current) => (current.pageIndex === 0 ? current : { ...current, pageIndex: 0 }));
	}, [activeFilterColumnId, filterValue, globalFilter, sorting]);

	useEffect(() => {
		if (pagination.pageIndex < pageCount) {
			return;
		}

		setPagination((current) => ({
			...current,
			pageIndex: Math.max(pageCount - 1, 0),
		}));
	}, [pageCount, pagination.pageIndex]);

	useEffect(() => {
		if (!selectedRow) {
			setSelectedRowId(null);
			return;
		}

		if (selectedRowId !== selectedRow.id) {
			setSelectedRowId(selectedRow.id);
		}
	}, [selectedRow, selectedRowId]);

	return (
		<section className="rounded-lg border border-zinc-950/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
			<div className="mb-5 flex flex-col gap-4">
				<div>
					<Subheading className="font-serif text-2xl">{title}</Subheading>
					{description ? <Text className="mt-2 max-w-2xl">{description}</Text> : null}
				</div>

				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-1 flex-col gap-3 md:flex-row">
						<Input
							className="md:max-w-sm"
							onChange={(event) => setGlobalFilter(event.target.value)}
							placeholder="Search rows"
							value={globalFilter}
						/>
						{activeFilterColumnId ? (
							<div className="flex flex-col gap-3 md:flex-row">
								<Select
									onChange={(event) => setFilterColumnId(event.target.value)}
									value={activeFilterColumnId}
								>
									{filterableColumns.map((item) => (
										<option key={item.column.id} value={item.column.id}>
											{item.column.id.replaceAll("_", " ")}
										</option>
									))}
								</Select>
								<Select
									onChange={(event) => setFilterValue(event.target.value)}
									value={filterValue}
								>
									<option value="all">All rows</option>
									{activeFilterValues.map((value) => (
										<option key={`${activeFilterColumnId}-${value}`} value={value}>
											{value}
										</option>
									))}
								</Select>
							</div>
						) : null}
					</div>

					<details className="group">
						<summary className="cursor-pointer list-none rounded-lg border border-zinc-950/10 bg-white px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:border-zinc-950/20 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-900 dark:text-white dark:hover:border-white/20 dark:hover:bg-zinc-800">
							Columns
						</summary>
						<div className="mt-3 grid min-w-56 gap-2 rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800">
							{table.getAllLeafColumns().map((column) => (
								<CheckboxField key={column.id}>
									<Checkbox
										checked={column.getIsVisible()}
										onChange={(checked) => column.toggleVisibility(checked)}
									/>
									<Label>{column.id.replaceAll("_", " ")}</Label>
								</CheckboxField>
							))}
						</div>
					</details>
				</div>
			</div>

			{filteredRows.length === 0 ? (
				<EmptyState body={emptyBody} title={emptyTitle} />
			) : (
				<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
					<div className="overflow-hidden rounded-lg border border-zinc-950/5 dark:border-white/10">
						<Table dense>
							<TableHead>
								{table.getHeaderGroups().map((headerGroup) => (
									<TableRow key={headerGroup.id}>
										{headerGroup.headers.map((header) => (
											<TableHeader
												className="text-[0.68rem] font-semibold uppercase tracking-[0.22em]"
												key={header.id}
											>
												{header.isPlaceholder ? null : (
													<button
														className="inline-flex items-center gap-2"
														onClick={header.column.getToggleSortingHandler()}
														type="button"
													>
														{flexRender(header.column.columnDef.header, header.getContext())}
													</button>
												)}
											</TableHeader>
										))}
									</TableRow>
								))}
							</TableHead>
							<TableBody>
								{paginatedRows.map((row) => (
									<TableRow
										className={`cursor-pointer transition ${
											selectedRow?.id === row.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
										}`}
										key={row.id}
										onClick={() => setSelectedRowId(row.id)}
									>
										{visibleColumns.map((column) => {
											const cell = row
												.getVisibleCells()
												.find((item) => item.column.id === column.id);

											if (!cell) {
												return null;
											}

											return (
												<TableCell className="align-top text-sm leading-6" key={cell.id}>
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</TableCell>
											);
										})}
									</TableRow>
								))}
							</TableBody>
						</Table>

						<div className="flex flex-col gap-4 border-t border-zinc-950/5 px-4 py-4 dark:border-white/10 sm:px-5">
							<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
								<div className="flex flex-wrap items-center gap-3">
									<Text className="text-sm text-zinc-600 dark:text-zinc-300">
										Showing {pageStart.toLocaleString()}-{pageEnd.toLocaleString()} of{" "}
										{filteredRows.length.toLocaleString()} rows
									</Text>
									<div className="flex items-center gap-2 [&>[data-slot=control]]:w-auto">
										<Text className="text-sm text-zinc-600 dark:text-zinc-300">Rows per page</Text>
										<Select
											className="min-w-24"
											onChange={(event) => {
												setPagination({
													pageIndex: 0,
													pageSize: Number(event.target.value),
												});
											}}
											value={String(pagination.pageSize)}
										>
											{EXPLORER_PAGE_SIZE_OPTIONS.map((value) => (
												<option key={value} value={value}>
													{value}
												</option>
											))}
										</Select>
									</div>
								</div>

								<Text className="text-sm text-zinc-600 dark:text-zinc-300">
									Page {currentPage.toLocaleString()} of {pageCount.toLocaleString()}
								</Text>
							</div>

							{pageCount > 1 ? (
								<Pagination aria-label={`${title} pagination`} className="items-center">
									<span className="grow basis-0">
										<Button
											disabled={!table.getCanPreviousPage()}
											onClick={() => table.previousPage()}
											plain
											aria-label="Previous page"
										>
											<svg
												className="stroke-current"
												data-slot="icon"
												viewBox="0 0 16 16"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M2.75 8H13.25M2.75 8L5.25 5.5M2.75 8L5.25 10.5"
													strokeWidth={1.5}
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
											Previous
										</Button>
									</span>

									<PaginationList>
										{paginationItems.map((item, index) =>
											item === null ? (
												<PaginationGap key={`gap-${index}`} />
											) : (
												<Button
													aria-current={item === currentPage ? "page" : undefined}
													aria-label={`Page ${item}`}
													className={`min-w-9 before:absolute before:-inset-px before:rounded-lg ${
														item === currentPage
															? "before:bg-zinc-950/5 dark:before:bg-white/10"
															: ""
													}`}
													key={item}
													onClick={() => table.setPageIndex(item - 1)}
													plain
												>
													<span className="-mx-0.5">{item}</span>
												</Button>
											),
										)}
									</PaginationList>

									<span className="flex grow basis-0 justify-end">
										<Button
											disabled={!table.getCanNextPage()}
											onClick={() => table.nextPage()}
											plain
											aria-label="Next page"
										>
											Next
											<svg
												className="stroke-current"
												data-slot="icon"
												viewBox="0 0 16 16"
												fill="none"
												aria-hidden="true"
											>
												<path
													d="M13.25 8L2.75 8M13.25 8L10.75 10.5M13.25 8L10.75 5.5"
													strokeWidth={1.5}
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										</Button>
									</span>
								</Pagination>
							) : null}
						</div>
					</div>

					<aside className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800">
						<div className="flex items-center justify-between gap-3">
							<Text className="font-semibold">Row drill-in</Text>
							<StatusPill tone="neutral">
								{selectedRow ? `row ${selectedRowPosition} of ${filteredRows.length}` : "empty"}
							</StatusPill>
						</div>

						{selectedRecord ? (
							<div className="mt-4 space-y-3">
								{Object.entries(selectedRecord).map(([key, value]) => (
									<div
										className="rounded-lg border border-zinc-950/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
										key={`${selectedRow?.id}-${key}`}
									>
										<p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
											{key.replaceAll("_", " ")}
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
		</section>
	);
}
