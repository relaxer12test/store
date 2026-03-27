import { Outlet, createFileRoute } from "@tanstack/react-router";
import { validateInternalShopsSearch } from "@/features/internal/internal-admin-route-state";

export const Route = createFileRoute("/_app/internal/shops")({
	validateSearch: validateInternalShopsSearch,
	component: InternalShopsLayoutRoute,
});

function InternalShopsLayoutRoute() {
	return <Outlet />;
}
