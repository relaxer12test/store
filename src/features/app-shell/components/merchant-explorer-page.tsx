import { Button } from "@/components/ui/cata/button";
import { Panel } from "@/components/ui/layout";
import { DataTableShell } from "@/components/ui/table";
import { buildExplorerColumns } from "@/features/app-shell/components/merchant-workspace-ui";
import type { MerchantExplorerData } from "@/shared/contracts/merchant-workspace";

export function MerchantExplorerPage({
	activeDatasetKey,
	data,
	onDatasetChange,
}: {
	activeDatasetKey: MerchantExplorerData["datasets"][number]["key"] | "";
	data: MerchantExplorerData;
	onDatasetChange: (dataset: MerchantExplorerData["datasets"][number]["key"]) => void;
}) {
	const activeDataset =
		data.datasets.find((dataset) => dataset.key === activeDatasetKey) ?? data.datasets[0] ?? null;

	return (
		<div className="grid gap-4">
			<Panel
				description="Explorer datasets stay useful without chat. Every dataset runs through the shared TanStack Table shell with search, sorting, visibility controls, and row drill-in."
				title="Explorer datasets"
			>
				<div className="flex flex-wrap gap-3">
					{data.datasets.map((dataset) => (
						<Button
							key={dataset.key}
							{...(dataset.key === activeDataset?.key
								? { color: "dark/zinc" as const }
								: { outline: true as const })}
							onClick={() => onDatasetChange(dataset.key)}
						>
							{dataset.title}
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
					title={activeDataset.title}
				/>
			) : null}
		</div>
	);
}
