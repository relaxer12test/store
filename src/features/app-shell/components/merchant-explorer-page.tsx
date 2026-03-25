import { useEffect, useState } from "react";
import { StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { DataTableShell } from "@/components/ui/table";
import { buildExplorerColumns } from "@/features/app-shell/components/merchant-workspace-ui";
import type { MerchantExplorerData } from "@/shared/contracts/merchant-workspace";

const datasetButtonClass =
	"rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50";
const datasetButtonActiveClass = `${datasetButtonClass} border-slate-950 bg-slate-950 text-white hover:bg-slate-800`;

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
						<button
							className={
								dataset.key === activeDataset?.key ? datasetButtonActiveClass : datasetButtonClass
							}
							key={dataset.key}
							onClick={() => setActiveDatasetKey(dataset.key)}
							type="button"
						>
							{dataset.title}
						</button>
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
