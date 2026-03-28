import { createFileRoute, Outlet } from "@tanstack/react-router";
import type { SidebarConsoleNavItem } from "@/components/ui/resource";
import { SidebarConsoleLayout } from "@/components/ui/resource";
import { MerchantAccessState } from "@/features/app-shell/components/merchant-access-state";
import { MerchantSessionGate } from "@/features/app-shell/components/merchant-session-gate";

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
	loader: async ({ context }) => {
		await context.auth.ensureEmbeddedViewer();
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
			<MerchantSessionGate fallback={<MerchantAccessState />}>
				<Outlet />
			</MerchantSessionGate>
		</SidebarConsoleLayout>
	);
}
