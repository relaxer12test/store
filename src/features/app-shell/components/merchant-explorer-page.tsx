import { useEffect, useState } from "react";
import { Button } from "@/components/ui/cata/button";
import { StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { DataTableShell } from "@/components/ui/table";
import { buildExplorerColumns } from "@/features/app-shell/components/merchant-workspace-ui";
import type { MerchantExplorerData } from "@/shared/contracts/merchant-workspace";

function formatDatasetTimestamp(value: string) {
	const parsed = Date.parse(value);

	return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
}

export function MerchantExplorerPage({ data }: { data: MerchantExplorerData }) {
	const [activeDatasetKey, setActiveDatasetKey] = useState(data.datasets[0]?.key ?? "");

	useEffect(() => {
		if (!data.datasets.some((dataset) => dataset.key === activeDatasetKey)) {
			setActiveDatasetKey(data.datasets[0]?.key ?? "");
		}
	}, [activeDatasetKey, data.datasets]);

	const activeDataset =
		data.datasets.find((dataset) => dataset.key === activeDatasetKey) ?? data.datasets[0] ?? null;

	return (
		<div className="grid gap-5">
			<Panel
				description="Explorer datasets stay useful without chat. Every dataset runs through the shared TanStack Table shell with search, sorting, visibility controls, and row drill-in."
				title="Explorer datasets"
			>
				<div className="flex flex-wrap items-center gap-3">
					<StatusPill tone="accent">merchant explorer</StatusPill>
					<StatusPill tone="neutral">{formatDatasetTimestamp(data.generatedAt)}</StatusPill>
				</div>

				<div className="mt-5 flex flex-wrap gap-3">
					{data.datasets.map((dataset) => (
						<Button
							key={dataset.key}
							{...(dataset.key === activeDataset?.key
								? { color: "dark/zinc" as const }
								: { outline: true as const })}
							onClick={() => setActiveDatasetKey(dataset.key)}
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
