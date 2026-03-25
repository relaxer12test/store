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

export function MerchantExplorerPage({ snapshot }: { snapshot: ModuleSnapshot }) {
	const records = snapshot.records ?? [];

	return (
		<div className="grid gap-5">
			<DataTableShell
				columns={buildColumns(records)}
				data={records}
				description="A single reusable TanStack Table shell drives explorer-style surfaces. Feature-specific cell behavior can be layered in later without refactoring every route."
				emptyBody="Once the warehouse sync lands, this grid will fill from normalized Shopify projections."
				emptyTitle="No records yet"
				title="Explorer grid"
			/>
			<MerchantModulePage snapshot={snapshot} />
		</div>
	);
}
