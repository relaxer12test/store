import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MerchantSettingsPage } from "@/features/app-shell/components/merchant-settings-page";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/app/settings")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(
			convexQuery(api.appShell.merchantModule, { module: "settings" }),
		);
	},
	component: MerchantSettingsRoute,
});

function MerchantSettingsRoute() {
	const { data } = useSuspenseQuery(
		convexQuery(api.appShell.merchantModule, { module: "settings" }),
	);

	return <MerchantSettingsPage snapshot={data} />;
}
