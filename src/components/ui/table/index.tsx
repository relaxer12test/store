import {
	type ColumnDef,
	type ColumnFiltersState,
	flexRender,
	getCoreRowModel,
	getFacetedRowModel,
	getFacetedUniqueValues,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { useEffect, useState } from "react";
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
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);

	const table = useReactTable({
		columns,
		data,
		getCoreRowModel: getCoreRowModel(),
		getFacetedRowModel: getFacetedRowModel(),
		getFacetedUniqueValues: getFacetedUniqueValues(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onColumnFiltersChange: setColumnFilters,
		onColumnVisibilityChange: setColumnVisibility,
		onGlobalFilterChange: setGlobalFilter,
		onSortingChange: setSorting,
		state: {
			columnFilters,
			columnVisibility,
			globalFilter,
			sorting,
		},
	});

	const rows = table.getRowModel().rows;
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
	const selectedRow = rows.find((row) => row.id === selectedRowId) ?? rows[0] ?? null;
	const selectedRecord = (selectedRow?.original ?? null) as Record<string, unknown> | null;

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
		if (!selectedRow) {
			setSelectedRowId(null);
			return;
		}

		if (selectedRowId !== selectedRow.id) {
			setSelectedRowId(selectedRow.id);
		}
	}, [selectedRow, selectedRowId]);

	return (
		<section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
			<div className="mb-5 flex flex-col gap-4">
				<div>
					<h2 className="font-serif text-2xl text-slate-950">{title}</h2>
					{description ? (
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
					) : null}
				</div>

				<div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-1 flex-col gap-3 md:flex-row">
						<input
							className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 md:max-w-sm"
							onChange={(event) => setGlobalFilter(event.target.value)}
							placeholder="Search rows"
							value={globalFilter}
						/>
						{activeFilterColumnId ? (
							<div className="flex flex-col gap-3 md:flex-row">
								<select
									className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
									onChange={(event) => setFilterColumnId(event.target.value)}
									value={activeFilterColumnId}
								>
									{filterableColumns.map((item) => (
										<option key={item.column.id} value={item.column.id}>
											{item.column.id.replaceAll("_", " ")}
										</option>
									))}
								</select>
								<select
									className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
									onChange={(event) => setFilterValue(event.target.value)}
									value={filterValue}
								>
									<option value="all">All rows</option>
									{activeFilterValues.map((value) => (
										<option key={`${activeFilterColumnId}-${value}`} value={value}>
											{value}
										</option>
									))}
								</select>
							</div>
						) : null}
					</div>

					<details className="group">
						<summary className="cursor-pointer list-none rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50">
							Columns
						</summary>
						<div className="mt-3 grid min-w-56 gap-2 rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
							{table.getAllLeafColumns().map((column) => (
								<label className="flex items-center gap-3 text-sm text-slate-900" key={column.id}>
									<input
										checked={column.getIsVisible()}
										className="size-4 rounded border border-slate-300 accent-slate-900"
										onChange={column.getToggleVisibilityHandler()}
										type="checkbox"
									/>
									<span>{column.id.replaceAll("_", " ")}</span>
								</label>
							))}
						</div>
					</details>
				</div>
			</div>

			{rows.length === 0 ? (
				<EmptyState body={emptyBody} title={emptyTitle} />
			) : (
				<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
					<div className="overflow-hidden rounded-[1.4rem] border border-slate-200">
						<div className="overflow-x-auto">
							<table className="min-w-full border-collapse">
								<thead className="bg-slate-50">
									{table.getHeaderGroups().map((headerGroup) => (
										<tr key={headerGroup.id}>
											{headerGroup.headers.map((header) => (
												<th
													className="px-4 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500"
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
												</th>
											))}
										</tr>
									))}
								</thead>
								<tbody>
									{rows.map((row) => (
										<tr
											className={`border-t border-slate-200 transition ${
												selectedRow?.id === row.id ? "bg-slate-100" : "bg-white hover:bg-slate-50"
											}`}
											key={row.id}
										>
											{visibleColumns.map((column) => {
												const cell = row
													.getVisibleCells()
													.find((item) => item.column.id === column.id);

												if (!cell) {
													return null;
												}

												return (
													<td
														className="px-4 py-3 align-top text-sm leading-6 text-slate-900"
														key={cell.id}
													>
														<button
															className="block w-full text-left"
															onClick={() => setSelectedRowId(row.id)}
															type="button"
														>
															{flexRender(cell.column.columnDef.cell, cell.getContext())}
														</button>
													</td>
												);
											})}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					<aside className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
						<div className="flex items-center justify-between gap-3">
							<p className="text-sm font-semibold text-slate-900">Row drill-in</p>
							<StatusPill tone="neutral">
								{selectedRow
									? `row ${rows.findIndex((row) => row.id === selectedRow.id) + 1}`
									: "empty"}
							</StatusPill>
						</div>

						{selectedRecord ? (
							<div className="mt-4 space-y-3">
								{Object.entries(selectedRecord).map(([key, value]) => (
									<div
										className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3"
										key={`${selectedRow?.id}-${key}`}
									>
										<p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
											{key.replaceAll("_", " ")}
										</p>
										<p className="mt-2 text-sm leading-6 text-slate-900">
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
