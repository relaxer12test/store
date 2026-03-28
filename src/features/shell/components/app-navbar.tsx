import { useTransition } from "react";
import { Avatar } from "@/components/ui/cata/avatar";
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
	const displayImage = auth.session.data?.user?.image ?? null;
	const displayInitials = auth.viewer?.viewer.initials;

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
					<Dropdown>
						<DropdownButton aria-label="Account menu" as={NavbarItem}>
							<Avatar
								alt={displayName}
								initials={displayImage ? undefined : displayInitials}
								src={displayImage}
							/>
						</DropdownButton>
						<DropdownMenu anchor="bottom end">
							{displayEmail ? (
								<>
									<div className="w-52 max-w-[calc(100vw-1rem)] min-w-0 px-3.5 py-2 text-sm/5 text-zinc-500 sm:px-3 sm:text-xs/5">
										<span className="block max-w-full truncate" title={displayEmail}>
											{displayEmail}
										</span>
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
