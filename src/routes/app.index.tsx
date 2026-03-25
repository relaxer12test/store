import { createFileRoute } from "@tanstack/react-router";
import { MerchantHome } from "@/features/app-shell/components/merchant-home";
import { useMerchantSnapshot } from "@/features/app-shell/merchant-snapshot";

export const Route = createFileRoute("/app/")({
	component: MerchantOverviewRoute,
});

function MerchantOverviewRoute() {
	const { data } = useMerchantSnapshot();

	return <MerchantHome snapshot={data} />;
}
