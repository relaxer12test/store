import { createFileRoute, redirect } from "@tanstack/react-router";
import type { SurfaceNavItem } from "@/components/ui/layout";
import { SurfaceLayout } from "@/features/app-shell/components/surface-layout";

const opsNav: SurfaceNavItem[] = [
	{
		description: "Platform-wide operations summary and watchlist.",
		title: "Overview",
		to: "/ops",
	},
	{
		description: "Tenant roster and install posture.",
		title: "Tenants",
		to: "/ops/tenants",
	},
	{
		description: "Backfill, reconciliation, and queue health.",
		title: "Sync jobs",
		to: "/ops/sync-jobs",
	},
	{
		description: "Inbound Shopify webhook posture and delivery logs.",
		title: "Webhooks",
		to: "/ops/webhooks",
	},
	{
		description: "Internal AI traces and approvals overview.",
		title: "AI traces",
		to: "/ops/ai-traces",
	},
];

export const Route = createFileRoute("/ops")({
	beforeLoad: ({ context }) => {
		if (!context.roles.includes("platform_admin")) {
			throw redirect({ to: "/install" });
		}
	},
	component: OpsLayoutRoute,
});

function OpsLayoutRoute() {
	const { session } = Route.useRouteContext();

	return (
		<SurfaceLayout
			description="Hidden platform-admin surface for tenant operations, sync supervision, and AI governance. This layout is role-gated before child loaders execute."
			eyebrow="Platform ops"
			navItems={opsNav}
			statusLabel={session.viewer?.name ?? "Platform preview"}
			title="Cross-tenant control plane"
		/>
	);
}
