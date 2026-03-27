import { Outlet, createFileRoute } from "@tanstack/react-router";
import { validateInternalWebhookSearch } from "@/features/internal/internal-admin-route-state";

export const Route = createFileRoute("/_app/internal/webhooks")({
	validateSearch: validateInternalWebhookSearch,
	component: InternalWebhooksLayoutRoute,
});

function InternalWebhooksLayoutRoute() {
	return <Outlet />;
}
