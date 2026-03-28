import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MerchantExplorerPage } from "@/features/app-shell/components/merchant-explorer-page";
import {
	getMerchantExplorerQuery,
	useMerchantExplorer,
} from "@/features/app-shell/merchant-workspace";
import {
	merchantExplorerDatasetKeys,
	type MerchantExplorerDatasetKey,
} from "@/shared/contracts/merchant-workspace";

const DEFAULT_MERCHANT_EXPLORER_DATASET = merchantExplorerDatasetKeys[0];

export const Route = createFileRoute("/_app/app/explorer")({
	validateSearch: (search: Record<string, unknown>) => ({
		dataset:
			typeof search.dataset === "string" &&
			merchantExplorerDatasetKeys.includes(search.dataset as MerchantExplorerDatasetKey)
				? (search.dataset as MerchantExplorerDatasetKey)
				: undefined,
	}),
	loaderDeps: ({ search }) => ({
		dataset: search.dataset ?? DEFAULT_MERCHANT_EXPLORER_DATASET,
	}),
	loader: async ({ context, deps }) => {
		await context.preload.ensureQueryData(getMerchantExplorerQuery(deps.dataset));
	},
	component: MerchantExplorerRoute,
});

function MerchantExplorerRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const search = Route.useSearch();
	const activeDatasetKey = search.dataset ?? DEFAULT_MERCHANT_EXPLORER_DATASET;
	const { data } = useMerchantExplorer(activeDatasetKey);

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
