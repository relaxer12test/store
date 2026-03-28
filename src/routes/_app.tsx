import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { StackedLayout } from "@/components/ui/cata/stacked-layout";
import { AppNavbar } from "@/features/shell/components/app-navbar";
import { AppSidebar } from "@/features/shell/components/app-sidebar";

export const Route = createFileRoute("/_app")({
	component: ChromeLayout,
});

function ChromeLayout() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const isSidebarRoute =
		pathname === "/internal" ||
		pathname.startsWith("/internal/") ||
		pathname === "/app" ||
		pathname.startsWith("/app/");

	return (
		<StackedLayout
			contentSurface={isSidebarRoute ? "plain" : "card"}
			contentWidth={isSidebarRoute ? "full" : "constrained"}
			navbar={<AppNavbar />}
			sidebar={<AppSidebar />}
		>
			<Outlet />
		</StackedLayout>
	);
}
