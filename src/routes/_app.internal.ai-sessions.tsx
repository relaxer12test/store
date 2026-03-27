import { Outlet, createFileRoute } from "@tanstack/react-router";
import { validateInternalAiSessionSearch } from "@/features/internal/internal-admin-route-state";

export const Route = createFileRoute("/_app/internal/ai-sessions")({
	validateSearch: validateInternalAiSessionSearch,
	component: InternalAiSessionsLayoutRoute,
});

function InternalAiSessionsLayoutRoute() {
	return <Outlet />;
}
