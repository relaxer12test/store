import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { StatusPill } from "@/components/ui/feedback";
import { SidebarConsoleLayout } from "@/components/ui/resource";
import { getCurrentViewerServer } from "@/lib/auth-functions";
import { hasAdminViewer } from "@/shared/contracts/auth";

const internalNavItems = [
	{
		description: "Live install posture, blockers, and the admin watchlist.",
		href: "/internal",
		label: "Overview",
	},
	{
		description: "Connected shops and install/auth state.",
		href: "/internal/shops",
		label: "Shops",
	},
	{
		description: "Projection freshness, refresh lag, and cache failures.",
		href: "/internal/cache",
		label: "Cache",
	},
	{
		description: "Queued jobs, retries, and workflow logs.",
		href: "/internal/workflows",
		label: "Workflows",
	},
	{
		description: "Inbound webhook deliveries and stored payload previews.",
		href: "/internal/webhooks",
		label: "Webhooks",
	},
	{
		description: "Audit entries and approval-side effects.",
		href: "/internal/audits",
		label: "Audits",
	},
	{
		description: "Storefront shopper sessions with live transcript drill-in.",
		href: "/internal/ai-sessions",
		label: "AI sessions",
	},
	{
		description: "Better Auth users, org membership, and admin roles.",
		href: "/internal/users",
		label: "Users",
	},
];

export const Route = createFileRoute("/_app/internal")({
	beforeLoad: async () => {
		if (!hasAdminViewer(await getCurrentViewerServer())) {
			throw redirect({
				to: "/auth/sign-in",
			});
		}
	},
	component: InternalLayoutRoute,
});

function InternalLayoutRoute() {
	return (
		<SidebarConsoleLayout
			description="Dedicated operator routes for high-volume internal data. Every module is URL-backed, paginated, and detail-first so the admin shell can scale with real Convex rows."
			eyebrow="Admin only"
			items={internalNavItems}
			navDescription="Route-backed admin surfaces for stores, jobs, events, and live shopper sessions."
			navEyebrow="Internal console"
			navTitle="Operator routes"
			status={<StatusPill tone="accent">URL-backed navigation</StatusPill>}
			title="Internal console"
		>
			<Outlet />
		</SidebarConsoleLayout>
	);
}
