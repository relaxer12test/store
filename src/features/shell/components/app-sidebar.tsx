import { useRouterState } from "@tanstack/react-router";
import { useTransition } from "react";
import {
	Sidebar,
	SidebarBody,
	SidebarDivider,
	SidebarHeader,
	SidebarItem,
	SidebarLabel,
	SidebarSection,
} from "@/components/ui/cata/sidebar";
import { SidebarNavigationLink } from "@/components/ui/navigation-state";
import { getShellNavigationItems } from "@/features/shell/navigation";
import { authClient, useAppAuth } from "@/lib/auth-client";
import { resolveNavigationItemActiveStates } from "@/lib/navigation";

export function AppSidebar() {
	const auth = useAppAuth();
	const [isPending, startTransition] = useTransition();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const showInternalNav = auth.isAdmin;
	const navigationItems = getShellNavigationItems(showInternalNav);
	const activeStates = resolveNavigationItemActiveStates(pathname, navigationItems);

	return (
		<Sidebar>
			<SidebarHeader>
				<SidebarSection>
					<SidebarNavigationLink activeState="inactive" href="/">
						<SidebarLabel>Shopify AI Console</SidebarLabel>
					</SidebarNavigationLink>
				</SidebarSection>
			</SidebarHeader>

			<SidebarBody>
				<SidebarSection>
					{navigationItems.map((item, index) => (
						<SidebarNavigationLink
							activeState={activeStates[index]}
							href={item.href}
							key={item.href}
						>
							<SidebarLabel>{item.label}</SidebarLabel>
						</SidebarNavigationLink>
					))}
				</SidebarSection>

				{showInternalNav ? (
					<>
						<SidebarDivider />
						<SidebarSection>
							<SidebarItem
								disabled={isPending}
								onClick={() => {
									startTransition(() => {
										void (async () => {
											await authClient.signOut();
											window.location.reload();
										})();
									});
								}}
							>
								<SidebarLabel>{isPending ? "Signing out…" : "Sign out"}</SidebarLabel>
							</SidebarItem>
						</SidebarSection>
					</>
				) : null}
			</SidebarBody>
		</Sidebar>
	);
}
