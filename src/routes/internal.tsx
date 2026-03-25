import { createFileRoute, redirect } from "@tanstack/react-router";
import type { SurfaceNavItem } from "@/components/ui/layout";
import { SurfaceLayout } from "@/features/app-shell/components/surface-layout";
import { isInternalToolsEnabled } from "@/lib/env";

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
];

export const Route = createFileRoute("/internal")({
	beforeLoad: ({ context }) => {
		if (!isInternalToolsEnabled()) {
			throw redirect({ to: "/" });
		}

		if (!import.meta.env.DEV && !context.roles.includes("internal_staff")) {
			throw redirect({ to: "/install" });
		}
	},
	component: InternalLayoutRoute,
});

function InternalLayoutRoute() {
	const { session } = Route.useRouteContext();

	return (
		<SurfaceLayout
			description="Dev-only diagnostics shell for install state, webhook deliveries, projection cache, and action audits. It is intentionally separate from merchant navigation."
			eyebrow="Internal tools"
			navItems={internalNav}
			statusLabel={session.viewer?.name ?? (import.meta.env.DEV ? "Local dev" : "Staff shell")}
			title="Internal diagnostics"
		/>
	);
}
