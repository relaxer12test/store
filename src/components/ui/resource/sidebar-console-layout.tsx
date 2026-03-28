"use client";

import { useRouterState } from "@tanstack/react-router";
import { Heading } from "@/components/ui/cata/heading";
import {
	Sidebar,
	SidebarBody,
	SidebarHeader,
	SidebarLabel,
	SidebarSection,
} from "@/components/ui/cata/sidebar";
import { SidebarLayout, useSidebarClose } from "@/components/ui/cata/sidebar-layout";
import { Text } from "@/components/ui/cata/text";
import { SidebarNavigationLink } from "@/components/ui/navigation-state";
import { resolveNavigationItemActiveStates } from "@/lib/navigation";

export interface SidebarConsoleNavItem {
	description: string;
	href: string;
	label: string;
}

function NavigationSidebar({
	items,
	navDescription,
	navEyebrow,
	navTitle,
}: {
	items: SidebarConsoleNavItem[];
	navDescription?: string;
	navEyebrow?: string;
	navTitle: string;
}) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const activeStates = resolveNavigationItemActiveStates(pathname, items);
	const closeSidebar = useSidebarClose();

	return (
		<Sidebar
			aria-label="Console navigation"
			className="h-full rounded-xl border border-zinc-950/6 bg-zinc-50/90 dark:border-white/10 dark:bg-zinc-950/80"
		>
			<SidebarHeader className="border-b border-zinc-950/6 px-4 py-3 dark:border-white/10">
				{navEyebrow ? (
					<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
						{navEyebrow}
					</Text>
				) : null}
				<Heading className="mt-1 text-base/6">{navTitle}</Heading>
				{navDescription ? <Text className="mt-1 text-xs/5">{navDescription}</Text> : null}
			</SidebarHeader>

			<SidebarBody className="px-3 py-3">
				<SidebarSection>
					{items.map((item, index) => {
						return (
							<SidebarNavigationLink
								activeState={activeStates[index]}
								href={item.href}
								key={item.href}
								onClick={closeSidebar ?? undefined}
							>
								<div className="min-w-0">
									<SidebarLabel>{item.label}</SidebarLabel>
									<Text className="truncate text-xs/4 text-zinc-500 dark:text-zinc-400">
										{item.description}
									</Text>
								</div>
							</SidebarNavigationLink>
						);
					})}
				</SidebarSection>
			</SidebarBody>
		</Sidebar>
	);
}

export function SidebarConsoleLayout({
	children,
	contentWidth = "constrained",
	items,
	mobileMenuLabel = "Sections",
	navDescription,
	navEyebrow,
	navTitle,
	title,
}: React.PropsWithChildren<{
	contentWidth?: "constrained" | "full";
	description?: string;
	eyebrow?: string;
	items: SidebarConsoleNavItem[];
	mobileMenuLabel?: string;
	navDescription?: string;
	navEyebrow?: string;
	navTitle: string;
	title: string;
}>) {
	return (
		<SidebarLayout
			contentWidth={contentWidth}
			navbar={
				<div className="px-2 py-2">
					<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
						{mobileMenuLabel}
					</Text>
					<Text className="mt-1 text-sm font-semibold text-zinc-950 dark:text-white">{title}</Text>
				</div>
			}
			sidebar={
				<NavigationSidebar
					items={items}
					navDescription={navDescription}
					navEyebrow={navEyebrow}
					navTitle={navTitle}
				/>
			}
		>
			{children}
		</SidebarLayout>
	);
}
