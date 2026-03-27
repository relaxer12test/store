import { createFileRoute, Outlet } from "@tanstack/react-router";
import { StackedLayout } from "@/components/ui/cata/stacked-layout";
import { AppNavbar } from "@/features/shell/components/app-navbar";
import { AppSidebar } from "@/features/shell/components/app-sidebar";

export const Route = createFileRoute("/_chrome")({
	component: ChromeLayout,
});

function ChromeLayout() {
	return (
		<StackedLayout navbar={<AppNavbar />} sidebar={<AppSidebar />}>
			<Outlet />
		</StackedLayout>
	);
}
