import { createFileRoute } from "@tanstack/react-router";
import { MerchantExplorerPage } from "@/features/app-shell/components/merchant-explorer-page";
import {
	merchantExplorerQuery,
	useMerchantExplorer,
} from "@/features/app-shell/merchant-workspace";
import { hasEmbeddedMerchantSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/app/explorer")({
	loader: async ({ context }) => {
		const session = await context.sessionApi.ensureEmbeddedSession();

		if (hasEmbeddedMerchantSession(session)) {
			await context.preload.ensureQueryData(merchantExplorerQuery);
		}
	},
	component: MerchantExplorerRoute,
});

function MerchantExplorerRoute() {
	const { data } = useMerchantExplorer();

	return <MerchantExplorerPage data={data} />;
}
