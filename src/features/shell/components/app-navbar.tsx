import { useTransition } from "react";
import { Badge } from "@/components/ui/cata/badge";
import {
	Navbar,
	NavbarDivider,
	NavbarItem,
	NavbarLabel,
	NavbarSection,
	NavbarSpacer,
} from "@/components/ui/cata/navbar";
import { authClient, useSessionEnvelope } from "@/lib/auth-client";
import { hasAdminSession } from "@/shared/contracts/session";

export function AppNavbar() {
	const session = useSessionEnvelope();
	const [isPending, startTransition] = useTransition();
	const showInternalNav = hasAdminSession(session);

	return (
		<Navbar>
			<NavbarSection>
				<NavbarItem href="/">
					<NavbarLabel>Shopify AI Console</NavbarLabel>
				</NavbarItem>
			</NavbarSection>

			<NavbarSpacer />

			<NavbarSection>
				<NavbarItem href="/">Marketing</NavbarItem>
				<NavbarItem href="/install">Install</NavbarItem>
				<NavbarItem href="/app">Merchant app</NavbarItem>
				{showInternalNav ? <NavbarItem href="/internal">Internal</NavbarItem> : null}
			</NavbarSection>

			<NavbarDivider />

			<NavbarSection>
				<Badge color={session.state === "ready" ? "green" : "amber"}>
					{session.state === "ready" ? "Convex live" : "Convex offline"}
				</Badge>

				{showInternalNav ? (
					<NavbarItem
						disabled={isPending}
						onClick={() => {
							startTransition(() => {
								void (async () => {
									await authClient.signOut();
									window.location.assign("/");
								})();
							});
						}}
					>
						{isPending ? "Signing out…" : "Sign out"}
					</NavbarItem>
				) : null}

				{session.viewer ? (
					<Badge color={session.roles.includes("admin") ? "blue" : "zinc"}>
						{session.viewer.name}
					</Badge>
				) : (
					<Badge color="zinc">Unauthenticated</Badge>
				)}
			</NavbarSection>
		</Navbar>
	);
}
