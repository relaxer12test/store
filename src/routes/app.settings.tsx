import { createFileRoute } from "@tanstack/react-router";
import { MerchantSettingsPage } from "@/features/app-shell/components/merchant-settings-page";
import { merchantSettingsQuery, useMerchantSettings } from "@/features/app-shell/merchant-settings";
import { hasEmbeddedMerchantSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/app/settings")({
	loader: async ({ context }) => {
		const session = await context.sessionApi.ensureEmbeddedSession();

		if (hasEmbeddedMerchantSession(session)) {
			await context.preload.ensureQueryData(merchantSettingsQuery);
		}
	},
	component: MerchantSettingsRoute,
});

function MerchantSettingsRoute() {
	const { data, isRefetching, refetch } = useMerchantSettings();

	return (
		<MerchantSettingsPage
			data={data}
			isRefreshing={isRefetching}
			onRefresh={() => void refetch()}
		/>
	);
}
