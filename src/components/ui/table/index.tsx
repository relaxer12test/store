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
import { Checkbox, CheckboxField } from "@/components/ui/cata/checkbox";
import { Label } from "@/components/ui/cata/fieldset";
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

			{rows.length === 0 ? (
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
								{rows.map((row) => (
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
					</div>

					<aside className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800">
						<div className="flex items-center justify-between gap-3">
							<Text className="font-semibold">Row drill-in</Text>
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
