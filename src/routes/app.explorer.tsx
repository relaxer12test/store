import { createFileRoute } from "@tanstack/react-router";
import { MerchantExplorerPage } from "@/features/app-shell/components/merchant-explorer-page";
import { useMerchantSnapshot } from "@/features/app-shell/merchant-snapshot";

export const Route = createFileRoute("/app/explorer")({
	component: MerchantExplorerRoute,
});

function MerchantExplorerRoute() {
	const { data } = useMerchantSnapshot();

	return <MerchantExplorerPage snapshot={data} />;
}
