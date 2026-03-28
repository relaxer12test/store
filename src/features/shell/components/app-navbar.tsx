import { useTransition } from "react";
import {
	Dropdown,
	DropdownButton,
	DropdownDivider,
	DropdownItem,
	DropdownLabel,
	DropdownMenu,
} from "@/components/ui/cata/dropdown";
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
	const displayEmail = auth.viewer?.viewer.email ?? auth.session.data?.user?.email ?? null;

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
				{displayName ? (
					<Dropdown as="div" className="relative">
						<DropdownButton as={NavbarItem}>{displayName}</DropdownButton>
						<DropdownMenu anchor="bottom end">
							{displayEmail ? (
								<>
									<div className="px-3.5 py-2 text-sm/5 text-zinc-500 sm:px-3 sm:text-xs/5">
										{displayEmail}
									</div>
									<DropdownDivider />
								</>
							) : null}
							<DropdownItem
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
								<DropdownLabel>{isPending ? "Signing out…" : "Sign out"}</DropdownLabel>
							</DropdownItem>
						</DropdownMenu>
					</Dropdown>
				) : (
					<NavbarItem href="/auth/sign-in">Sign in</NavbarItem>
				)}
			</NavbarSection>
		</Navbar>
	);
}
