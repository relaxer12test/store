import { Outlet, createFileRoute } from "@tanstack/react-router";
import { validateInternalCacheSearch } from "@/features/internal/internal-admin-route-state";

export const Route = createFileRoute("/_app/internal/cache")({
	validateSearch: validateInternalCacheSearch,
	component: InternalCacheLayoutRoute,
});

function InternalCacheLayoutRoute() {
	return <Outlet />;
}
