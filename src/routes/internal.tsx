import { createFileRoute, redirect } from "@tanstack/react-router";
import type { SurfaceNavItem } from "@/components/ui/layout";
import { SurfaceLayout } from "@/features/app-shell/components/surface-layout";
import { useSessionEnvelope } from "@/lib/auth-client";
import { getSessionEnvelope } from "@/lib/auth-server";
import { hasAdminSession } from "@/shared/contracts/session";

const internalNav: SurfaceNavItem[] = [
	{
		description: "Disposable summary of install, cache, webhook, and audit posture.",
		title: "Overview",
		to: "/internal",
	},
	{
		description: "Install metadata, bootstrap state, and auth/debug checkpoints.",
		title: "Install state",
		to: "/internal/install-state",
	},
	{
		description: "Cached projections, sync freshness, and debug mirrors.",
		title: "Cache",
		to: "/internal/cache",
	},
	{
		description: "Inbound Shopify webhook posture and delivery logs.",
		title: "Webhooks",
		to: "/internal/webhooks",
	},
	{
		description: "Approval traces, tool proposals, and executed actions.",
		title: "Action audits",
		to: "/internal/action-audits",
	},
	{
		description: "Better Auth users, native admin roles, and merchant-to-admin access handoff.",
		title: "Users",
		to: "/internal/users",
	},
];

export const Route = createFileRoute("/internal")({
	beforeLoad: async ({ context }) => {
		const currentSession = context.sessionManager.getState();
		const session =
			currentSession.authMode === "none" ? await getSessionEnvelope() : currentSession;

		context.setSession(session);

		if (!hasAdminSession(session)) {
			throw redirect({
				to: "/internal-auth",
			});
		}
	},
	component: InternalLayoutRoute,
});

function InternalLayoutRoute() {
	const session = useSessionEnvelope();

	return (
		<SurfaceLayout
			description="Dev-only diagnostics shell for install state, webhook deliveries, projection cache, and action audits. It is intentionally separate from merchant navigation."
			eyebrow="Internal tools"
			navItems={internalNav}
			statusLabel={session.viewer?.name ?? (import.meta.env.DEV ? "Local dev" : "Admin shell")}
			title="Internal diagnostics"
		/>
	);
}
