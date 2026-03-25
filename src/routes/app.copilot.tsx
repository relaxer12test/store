import { createFileRoute } from "@tanstack/react-router";
import { MerchantCopilotPage } from "@/features/app-shell/components/merchant-copilot-page";
import {
	merchantCopilotStateQuery,
	useMerchantCopilotState,
} from "@/features/app-shell/merchant-workspace";
import { hasEmbeddedMerchantSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/app/copilot")({
	loader: async ({ context }) => {
		const session = await context.sessionApi.ensureEmbeddedSession();

		if (hasEmbeddedMerchantSession(session)) {
			await context.preload.ensureQueryData(merchantCopilotStateQuery);
		}
	},
	component: MerchantCopilotRoute,
});

function MerchantCopilotRoute() {
	const { data } = useMerchantCopilotState();

	return <MerchantCopilotPage initialConversation={data} />;
}
