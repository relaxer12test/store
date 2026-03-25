import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTableShell } from "@/components/ui/table";
import type { TableRecord } from "@/shared/contracts/app-shell";

const columnHelper = createColumnHelper<TableRecord>();

function buildColumns(records: TableRecord[]): ColumnDef<TableRecord>[] {
	const keys = Object.keys(records[0] ?? {}).filter((key) => key !== "id");

	return keys.map((key) =>
		columnHelper.accessor((row) => row[key], {
			cell: (info) => info.getValue(),
			header: key.replaceAll("_", " "),
			id: key,
		}),
	) as ColumnDef<TableRecord>[];
}

export function InternalModulePage({
	description,
	emptyBody,
	emptyTitle,
	records,
	title,
}: {
	description: string;
	emptyBody: string;
	emptyTitle: string;
	records: TableRecord[];
	title: string;
}) {
	return (
		<DataTableShell
			columns={buildColumns(records)}
			data={records}
			description={description}
			emptyBody={emptyBody}
			emptyTitle={emptyTitle}
			title={title}
		/>
	);
}
