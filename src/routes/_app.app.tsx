import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { SidebarConsoleNavItem } from "@/components/ui/resource";
import { SidebarConsoleLayout } from "@/components/ui/resource";
import { currentViewerQuery } from "@/lib/auth-queries";
import type { AppViewerContext } from "@/shared/contracts/auth";
import { hasAdminViewer, hasMerchantAppAccess } from "@/shared/contracts/auth";

const appNav: SidebarConsoleNavItem[] = [
	{
		description: "Store health and recent activity.",
		href: "/app",
		label: "Overview",
	},
	{
		description: "AI assistant for store questions and actions.",
		href: "/app/copilot",
		label: "Copilot",
	},
	{
		description: "Browse and search store data.",
		href: "/app/explorer",
		label: "Explorer",
	},
	{
		description: "Background jobs and queue status.",
		href: "/app/workflows",
		label: "Workflows",
	},
	{
		description: "Widget settings and install health.",
		href: "/app/settings",
		label: "Settings",
	},
];

export const Route = createFileRoute("/_app/app")({
	beforeLoad: async ({ context }) => {
		const cachedViewer =
			(context.queryClient.getQueryData(currentViewerQuery.queryKey) as
				| AppViewerContext
				| null
				| undefined) ?? null;

		if (hasMerchantAppAccess(cachedViewer) || hasAdminViewer(cachedViewer)) {
			return;
		}

		const embeddedViewer = await context.auth.ensureEmbeddedViewer();
		const viewer = hasMerchantAppAccess(embeddedViewer) ? embeddedViewer : cachedViewer;

		if (hasMerchantAppAccess(viewer) || hasAdminViewer(viewer)) {
			return;
		}

		throw redirect({
			to: hasAdminViewer(viewer) ? "/internal" : "/install",
		});
	},
	component: MerchantLayoutRoute,
});

function MerchantLayoutRoute() {
	return (
		<SidebarConsoleLayout
			description="Manage your store, review copilot suggestions, and configure settings."
			eyebrow="Merchant app"
			items={appNav}
			navTitle="Navigation"
			title="Your store"
		>
			<Outlet />
		</SidebarConsoleLayout>
	);
}
