import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { SidebarConsoleLayout } from "@/components/ui/resource";
import { currentViewerQuery } from "@/lib/auth-queries";
import { hasAdminViewer } from "@/shared/contracts/auth";

const internalNavItems = [
	{
		description: "System health and active alerts.",
		href: "/internal",
		label: "Overview",
	},
	{
		description: "Connected shops and install status.",
		href: "/internal/shops",
		label: "Shops",
	},
	{
		description: "Cache status and refresh health.",
		href: "/internal/cache",
		label: "Cache",
	},
	{
		description: "Background jobs and retries.",
		href: "/internal/workflows",
		label: "Workflows",
	},
	{
		description: "Webhook deliveries and payloads.",
		href: "/internal/webhooks",
		label: "Webhooks",
	},
	{
		description: "Audit trail and recorded actions.",
		href: "/internal/audits",
		label: "Audits",
	},
	{
		description: "Shopper chat sessions and transcripts.",
		href: "/internal/ai-sessions",
		label: "AI sessions",
	},
	{
		description: "Users, roles, and membership.",
		href: "/internal/users",
		label: "Users",
	},
];

export const Route = createFileRoute("/_app/internal")({
	beforeLoad: async ({ context }) => {
		const viewer = await context.preload.ensureQueryData(currentViewerQuery);

		if (!hasAdminViewer(viewer)) {
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
			description="System-wide admin views for shops, jobs, events, and sessions."
			eyebrow="Admin"
			items={internalNavItems}
			navTitle="Navigation"
			title="Internal console"
		>
			<Outlet />
		</SidebarConsoleLayout>
	);
}
