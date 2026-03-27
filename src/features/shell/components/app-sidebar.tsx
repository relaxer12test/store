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
import { authClient, useSessionEnvelope } from "@/lib/auth-client";
import { persistAppConvexTokenCookie } from "@/lib/convex-session-bridge";
import { guestSession } from "@/lib/session-envelope";
import { hasAdminSession } from "@/shared/contracts/session";

export function AppSidebar() {
	const session = useSessionEnvelope();
	const [isPending, startTransition] = useTransition();
	const showInternalNav = hasAdminSession(session);

	return (
		<Sidebar>
			<SidebarHeader>
				<SidebarSection>
					<SidebarItem href="/">
						<SidebarLabel>Shopify AI Console</SidebarLabel>
					</SidebarItem>
				</SidebarSection>
			</SidebarHeader>

			<SidebarBody>
				<SidebarSection>
					<SidebarItem href="/">
						<SidebarLabel>Marketing</SidebarLabel>
					</SidebarItem>
					<SidebarItem href="/install">
						<SidebarLabel>Install</SidebarLabel>
					</SidebarItem>
					<SidebarItem href="/app">
						<SidebarLabel>Merchant app</SidebarLabel>
					</SidebarItem>
					{showInternalNav ? (
						<SidebarItem href="/internal">
							<SidebarLabel>Internal</SidebarLabel>
						</SidebarItem>
					) : null}
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
											persistAppConvexTokenCookie(guestSession);
											window.location.assign("/");
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
