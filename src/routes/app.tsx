import { createFileRoute } from "@tanstack/react-router";
import type { SurfaceNavItem } from "@/components/ui/layout";
import { EmbeddedAppShellBanner } from "@/features/app-shell/components/embedded-app-shell-banner";
import { MerchantAccessState } from "@/features/app-shell/components/merchant-access-state";
import { SurfaceLayout } from "@/features/app-shell/components/surface-layout";
import { merchantSnapshotQuery } from "@/features/app-shell/merchant-snapshot";
import { useSessionEnvelope } from "@/features/auth/session/client";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";
import { hasEmbeddedMerchantSession } from "@/shared/contracts/session";

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
	loader: async ({ context }) => {
		const session = await context.sessionApi.ensureEmbeddedSession();

		if (hasEmbeddedMerchantSession(session)) {
			await context.preload.ensureQueryData(merchantSnapshotQuery);
		}
	},
	component: MerchantLayoutRoute,
});

function MerchantLayoutRoute() {
	const session = useSessionEnvelope();
	const embeddedApp = useEmbeddedAppBootstrap();
	const hasMerchantSession = hasEmbeddedMerchantSession(session);

	return (
		<SurfaceLayout
			description="Embedded Shopify app shell for merchants. The route can render as a lightweight shell first, then layer on App Bridge-authenticated requests without full-page redirects or route rewrites."
			eyebrow="Merchant app"
			navItems={appNav}
			notice={<EmbeddedAppShellBanner />}
			statusLabel={
				session.activeShop?.name ??
				embeddedApp.shop ??
				(embeddedApp.isEmbedded ? "Shopify admin shell" : "Local development shell")
			}
			title="Store operating cockpit"
		>
			{hasMerchantSession ? undefined : <MerchantAccessState />}
		</SurfaceLayout>
	);
}
