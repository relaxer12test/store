import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui/feedback";

interface DataTableShellProps<TData> {
	columns: ColumnDef<TData>[];
	data: TData[];
	description?: string;
	emptyBody: string;
	emptyTitle: string;
	title: string;
}

export function DataTableShell<TData>({
	columns,
	data,
	description,
	emptyBody,
	emptyTitle,
	title,
}: DataTableShellProps<TData>) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState("");

	const table = useReactTable({
		columns,
		data,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		onGlobalFilterChange: setGlobalFilter,
		onSortingChange: setSorting,
		state: {
			globalFilter,
			sorting,
		},
	});

	const rows = table.getRowModel().rows;
	const visibleColumns = useMemo(() => table.getVisibleLeafColumns(), [table]);

	return (
		<section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
			<div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
				<div>
					<h2 className="font-serif text-2xl text-slate-950">{title}</h2>
					{description ? (
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>
					) : null}
				</div>

				<input
					className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 lg:max-w-xs"
					onChange={(event) => setGlobalFilter(event.target.value)}
					placeholder="Filter rows"
					value={globalFilter}
				/>
			</div>

			{rows.length === 0 ? (
				<EmptyState body={emptyBody} title={emptyTitle} />
			) : (
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
										className="border-t border-slate-200 bg-white transition hover:bg-slate-50"
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
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</td>
											);
										})}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			)}
		</section>
	);
}
