import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AuthLayout } from "@/components/ui/cata/auth-layout";
import { resolveRequestSessionEnvelope } from "@/lib/auth-server";
import { refreshInternalSessionEnvelope } from "@/lib/direct-convex-auth";
import { isServer } from "@/lib/env";
import { hasAdminSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/auth")({
	beforeLoad: async ({ context }) => {
		const currentSession = context.sessionManager.getState();
		const session =
			currentSession.authMode !== "none"
				? currentSession
				: isServer
					? await resolveRequestSessionEnvelope()
					: await refreshInternalSessionEnvelope();

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
