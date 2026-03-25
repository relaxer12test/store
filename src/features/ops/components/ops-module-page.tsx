import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { DataTableShell } from "@/components/ui/table";
import { MerchantModulePage } from "@/features/app-shell/components/merchant-module-page";
import type { ModuleSnapshot, TableRecord } from "@/shared/contracts/app-shell";

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

export function OpsModulePage({ snapshot }: { snapshot: ModuleSnapshot }) {
	const records = snapshot.records ?? [];

	return (
		<div className="grid gap-5">
			{records.length > 0 ? (
				<DataTableShell
					columns={buildColumns(records)}
					data={records}
					description="The same generic table shell supports internal diagnostics without introducing a second rendering stack."
					emptyBody="This surface will fill once jobs, webhook deliveries, and trace events are flowing through Convex."
					emptyTitle="Nothing to inspect yet"
					title={snapshot.title}
				/>
			) : null}
			<MerchantModulePage snapshot={snapshot} />
		</div>
	);
}
