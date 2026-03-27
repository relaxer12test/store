import { Outlet, createFileRoute } from "@tanstack/react-router";
import { validateInternalWorkflowSearch } from "@/features/internal/internal-admin-route-state";

export const Route = createFileRoute("/_app/internal/workflows")({
	validateSearch: validateInternalWorkflowSearch,
	component: InternalWorkflowsLayoutRoute,
});

function InternalWorkflowsLayoutRoute() {
	return <Outlet />;
}
