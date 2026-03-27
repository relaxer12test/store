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
import { authClient, useAppAuth } from "@/lib/auth-client";

export function AppNavbar() {
	const auth = useAppAuth();
	const [isPending, startTransition] = useTransition();
	const showInternalNav = auth.isAdmin;
	const displayName = auth.viewer?.viewer.name ?? auth.session.data?.user?.name ?? null;

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
				<Badge color={auth.hasSession ? "green" : "amber"}>
					{auth.hasSession ? "Signed in" : "Signed out"}
				</Badge>

				{showInternalNav ? (
					<NavbarItem
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
						{isPending ? "Signing out…" : "Sign out"}
					</NavbarItem>
				) : null}

				{displayName ? (
					<Badge color={auth.isAdmin ? "blue" : "zinc"}>{displayName}</Badge>
				) : (
					<Badge color="zinc">Unauthenticated</Badge>
				)}
			</NavbarSection>
		</Navbar>
	);
}
