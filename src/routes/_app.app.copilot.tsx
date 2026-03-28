import { createFileRoute } from "@tanstack/react-router";
import { MerchantCopilotPage } from "@/features/app-shell/components/merchant-copilot-page";
import {
	merchantCopilotStateQuery,
	useMerchantCopilotState,
} from "@/features/app-shell/merchant-workspace";

export const Route = createFileRoute("/_app/app/copilot")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(merchantCopilotStateQuery);
	},
	component: MerchantCopilotRoute,
});

function MerchantCopilotRoute() {
	const { data } = useMerchantCopilotState();

	return <MerchantCopilotPage conversation={data} />;
}
