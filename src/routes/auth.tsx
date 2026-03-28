import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AuthLayout } from "@/components/ui/cata/auth-layout";
import { getCurrentViewerServer } from "@/lib/auth-functions";
import { hasAdminViewer } from "@/shared/contracts/auth";

export const Route = createFileRoute("/auth")({
	beforeLoad: async () => {
		if (hasAdminViewer(await getCurrentViewerServer())) {
			throw redirect({
				to: "/internal/overview",
			});
		}
	},
	component: AuthLayoutRoute,
});

function AuthLayoutRoute() {
	return (
		<AuthLayout>
			<Outlet />
		</AuthLayout>
	);
}
