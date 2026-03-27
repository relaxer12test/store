import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AuthLayout } from "@/components/ui/cata/auth-layout";
import { getSessionEnvelope } from "@/lib/auth-server";
import { hasAdminSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/auth")({
	beforeLoad: async ({ context }) => {
		const currentSession = context.sessionManager.getState();
		const session =
			currentSession.authMode === "none" ? await getSessionEnvelope() : currentSession;

		context.setSession(session);

		if (hasAdminSession(session)) {
			throw redirect({
				to: "/internal",
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
