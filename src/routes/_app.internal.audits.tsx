import { Outlet, createFileRoute } from "@tanstack/react-router";
import { validateInternalAuditSearch } from "@/features/internal/internal-admin-route-state";

export const Route = createFileRoute("/_app/internal/audits")({
	validateSearch: validateInternalAuditSearch,
	component: InternalAuditsLayoutRoute,
});

function InternalAuditsLayoutRoute() {
	return <Outlet />;
}
