import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { SurfaceNavItem } from "@/components/ui/layout";
import { EmbeddedAppShellBanner } from "@/features/app-shell/components/embedded-app-shell-banner";
import { MerchantAccessState } from "@/features/app-shell/components/merchant-access-state";
import { MerchantSessionGate } from "@/features/app-shell/components/merchant-session-gate";
import { SurfaceLayout } from "@/features/app-shell/components/surface-layout";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";
import { useAppAuth } from "@/lib/auth-client";

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

export const Route = createFileRoute("/_app/app")({
	loader: async ({ context }) => {
		await context.auth.ensureEmbeddedViewer();
	},
	component: MerchantLayoutRoute,
});

function MerchantLayoutRoute() {
	const auth = useAppAuth();
	const embeddedApp = useEmbeddedAppBootstrap();

	return (
		<SurfaceLayout
			description="Embedded Shopify app shell for merchants. The route can render as a lightweight shell first, then layer on App Bridge-authenticated requests without full-page redirects or route rewrites."
			eyebrow="Merchant app"
			navItems={appNav}
			notice={<EmbeddedAppShellBanner />}
			statusLabel={
				auth.isMerchant
					? "Merchant workspace ready"
					: embeddedApp.isEmbedded
						? "Shopify admin shell"
						: "Local development shell"
			}
			title="Store operating cockpit"
		>
			<MerchantSessionGate fallback={<MerchantAccessState />}>
				<Outlet />
			</MerchantSessionGate>
		</SurfaceLayout>
	);
}
