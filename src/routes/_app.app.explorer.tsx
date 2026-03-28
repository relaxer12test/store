import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MerchantExplorerPage } from "@/features/app-shell/components/merchant-explorer-page";
import {
	merchantExplorerQuery,
	useMerchantExplorer,
} from "@/features/app-shell/merchant-workspace";

export const Route = createFileRoute("/_app/app/explorer")({
	validateSearch: (search: Record<string, unknown>) => ({
		dataset: typeof search.dataset === "string" ? search.dataset : undefined,
	}),
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(merchantExplorerQuery);
	},
	component: MerchantExplorerRoute,
});

function MerchantExplorerRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const search = Route.useSearch();
	const { data } = useMerchantExplorer();
	const activeDatasetKey =
		data.datasets.find((dataset) => dataset.key === search.dataset)?.key ??
		data.datasets[0]?.key ??
		"";

	return (
		<MerchantExplorerPage
			activeDatasetKey={activeDatasetKey}
			data={data}
			onDatasetChange={(dataset) => {
				void navigate({
					search: (current) => ({
						...current,
						dataset,
					}),
				});
			}}
		/>
	);
}
