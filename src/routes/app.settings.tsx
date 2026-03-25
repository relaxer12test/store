import { createFileRoute } from "@tanstack/react-router";
import { MerchantSettingsPage } from "@/features/app-shell/components/merchant-settings-page";
import { useMerchantSnapshot } from "@/features/app-shell/merchant-snapshot";

export const Route = createFileRoute("/app/settings")({
	component: MerchantSettingsRoute,
});

function MerchantSettingsRoute() {
	const { data } = useMerchantSnapshot();

	return <MerchantSettingsPage snapshot={data} />;
}
