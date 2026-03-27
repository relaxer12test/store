import { createFileRoute } from "@tanstack/react-router";
import { MerchantCopilotPage } from "@/features/app-shell/components/merchant-copilot-page";
import {
	merchantCopilotStateQuery,
	useMerchantCopilotState,
} from "@/features/app-shell/merchant-workspace";
import { hasMerchantViewer } from "@/shared/contracts/auth";

export const Route = createFileRoute("/_chrome/app/copilot")({
	loader: async ({ context }) => {
		const viewer = await context.auth.ensureEmbeddedViewer();

		if (hasMerchantViewer(viewer)) {
			await context.preload.ensureQueryData(merchantCopilotStateQuery);
		}
	},
	component: MerchantCopilotRoute,
});

function MerchantCopilotRoute() {
	const { data } = useMerchantCopilotState();

	return <MerchantCopilotPage conversation={data} />;
}
