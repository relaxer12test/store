import { createFileRoute } from "@tanstack/react-router";
import { MerchantCopilotPage } from "@/features/app-shell/components/merchant-copilot-page";
import { useMerchantSnapshot } from "@/features/app-shell/merchant-snapshot";

export const Route = createFileRoute("/app/copilot")({
	component: MerchantCopilotRoute,
});

function MerchantCopilotRoute() {
	const { data } = useMerchantSnapshot();

	return <MerchantCopilotPage snapshot={data} />;
}
