"use client";

import { useRouterState } from "@tanstack/react-router";
import { Heading } from "@/components/ui/cata/heading";
import {
	Sidebar,
	SidebarBody,
	SidebarHeader,
	SidebarItem,
	SidebarLabel,
	SidebarSection,
} from "@/components/ui/cata/sidebar";
import { SidebarLayout } from "@/components/ui/cata/sidebar-layout";
import { Text } from "@/components/ui/cata/text";

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
	onNavigate,
}: {
	items: SidebarConsoleNavItem[];
	navDescription?: string;
	navEyebrow?: string;
	navTitle: string;
	onNavigate?: () => void;
}) {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});

	return (
		<Sidebar className="h-full rounded-[2rem] border border-zinc-950/6 bg-zinc-50/90 dark:border-white/10 dark:bg-zinc-950/80">
			<SidebarHeader className="border-b border-zinc-950/6 px-5 py-5 dark:border-white/10">
				{navEyebrow ? (
					<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
						{navEyebrow}
					</Text>
				) : null}
				<Heading className="mt-2 text-xl/7">{navTitle}</Heading>
				{navDescription ? <Text className="mt-2">{navDescription}</Text> : null}
			</SidebarHeader>

			<SidebarBody className="px-4 py-5">
				<SidebarSection>
					{items.map((item) => {
						const current = pathname === item.href || pathname.startsWith(`${item.href}/`);

						return (
							<SidebarItem current={current} href={item.href} key={item.href} onClick={onNavigate}>
								<div className="min-w-0">
									<SidebarLabel>{item.label}</SidebarLabel>
									<Text className="mt-1 truncate text-xs/5 text-zinc-500 dark:text-zinc-400">
										{item.description}
									</Text>
								</div>
							</SidebarItem>
						);
					})}
				</SidebarSection>
			</SidebarBody>
		</Sidebar>
	);
}

export function SidebarConsoleLayout({
	children,
	description,
	eyebrow,
	items,
	mobileMenuLabel = "Sections",
	navDescription,
	navEyebrow,
	navTitle,
	status,
	title,
}: React.PropsWithChildren<{
	description: string;
	eyebrow?: string;
	items: SidebarConsoleNavItem[];
	mobileMenuLabel?: string;
	navDescription?: string;
	navEyebrow?: string;
	navTitle: string;
	status?: React.ReactNode;
	title: string;
}>) {
	return (
		<SidebarLayout
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
			<div className="grid gap-6">
				<header className="flex flex-col gap-4 rounded-[2rem] border border-zinc-950/6 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,244,245,0.94))] px-6 py-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(24,24,27,0.98),rgba(9,9,11,0.94))]">
					<div className="flex items-start justify-between gap-4">
						<div className="max-w-3xl">
							{eyebrow ? (
								<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-zinc-500">
									{eyebrow}
								</Text>
							) : null}
							<Heading className="mt-3 text-3xl/10">{title}</Heading>
							<Text className="mt-3 max-w-2xl">{description}</Text>
						</div>

						{status ? <div className="hidden lg:flex">{status}</div> : null}
					</div>
				</header>

				<div className="min-w-0">{children}</div>
			</div>
		</SidebarLayout>
	);
}
