import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MerchantSettingsPage } from "@/features/app-shell/components/merchant-settings-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/app/settings")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: MerchantSettingsRoute,
});

function MerchantSettingsRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return <MerchantSettingsPage snapshot={data} />;
}
