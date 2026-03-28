import { Button } from "@/components/ui/cata/button";
import { Panel } from "@/components/ui/layout";
import { DataTableShell } from "@/components/ui/table";
import { buildExplorerColumns } from "@/features/app-shell/components/merchant-workspace-ui";
import type {
	MerchantExplorerData,
	MerchantExplorerDatasetKey,
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

export function MerchantExplorerPage({
	activeDatasetKey,
	data,
	onDatasetChange,
}: {
	activeDatasetKey: MerchantExplorerDatasetKey;
	data: MerchantExplorerData;
	onDatasetChange: (dataset: MerchantExplorerDatasetKey) => void;
}) {
	const activeDataset = data.datasets[0] ?? null;

	return (
		<div className="grid gap-4">
			<Panel
				description="Explorer datasets stay useful without chat. Every dataset runs through the shared TanStack Table shell with search, sorting, visibility controls, and row drill-in."
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
						>
							{dataset.label}
						</Button>
					))}
				</div>
			</Panel>

			{activeDataset ? (
				<DataTableShell
					columns={buildExplorerColumns(activeDataset.rows)}
					data={activeDataset.rows}
					description={activeDataset.description}
					emptyBody={`No ${activeDataset.title.toLowerCase()} rows are available for this shop yet.`}
					emptyTitle={`No ${activeDataset.title.toLowerCase()} rows`}
					key={activeDataset.key}
					title={activeDataset.title}
				/>
			) : null}
		</div>
	);
}
