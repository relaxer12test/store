import { Outlet, createFileRoute } from "@tanstack/react-router";
import { validateInternalUsersSearch } from "@/features/internal/internal-admin-route-state";

export const Route = createFileRoute("/_app/internal/users")({
	validateSearch: validateInternalUsersSearch,
	component: InternalUsersLayoutRoute,
});

function InternalUsersLayoutRoute() {
	return <Outlet />;
}
