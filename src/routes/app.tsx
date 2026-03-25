import { createFileRoute, redirect } from "@tanstack/react-router";
import type { SurfaceNavItem } from "@/components/ui/layout";
import { SurfaceLayout } from "@/features/app-shell/components/surface-layout";

const appNav: SurfaceNavItem[] = [
	{
		description: "Warehouse-backed merchant overview with no-spinner first load.",
		title: "Overview",
		to: "/app",
	},
	{
		description: "Approval-aware assistant surface for admin questions and actions.",
		title: "Copilot",
		to: "/app/copilot",
	},
	{
		description: "Composable table shell for explorer-style merchant grids.",
		title: "Explorer",
		to: "/app/explorer",
	},
	{
		description: "Async jobs, queues, and workflow diagnostics.",
		title: "Workflows",
		to: "/app/workflows",
	},
	{
		description: "Reusable form wrappers for settings and install health.",
		title: "Settings",
		to: "/app/settings",
	},
];

export const Route = createFileRoute("/app")({
	beforeLoad: ({ context }) => {
		if (!context.viewer) {
			throw redirect({ to: "/install" });
		}
	},
	component: MerchantLayoutRoute,
});

function MerchantLayoutRoute() {
	const { session } = Route.useRouteContext();

	return (
		<SurfaceLayout
			description="Embedded Shopify app shell for merchants. The first load already includes real query data from Convex and transitions keep previous content visible while new route data preloads."
			eyebrow="Merchant app"
			navItems={appNav}
			statusLabel={session.activeShop?.name ?? "Preview tenant"}
			title="Store operating cockpit"
		/>
	);
}
