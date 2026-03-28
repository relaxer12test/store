"use client";

import * as Headless from "@headlessui/react";
import clsx from "clsx";
import { motion } from "motion/react";
import type React from "react";
import { TouchTarget } from "@/components/ui/cata/button";
import { Link } from "@/components/ui/cata/link";
import type { NavigationItemActiveState } from "@/lib/navigation";

const navbarNavigationClasses = clsx(
	"relative flex min-w-0 items-center gap-3 rounded-lg p-2 text-left text-base/6 font-medium text-zinc-950 sm:text-sm/5",
	"*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-500 sm:*:data-[slot=icon]:size-5",
	"*:not-nth-2:last:data-[slot=icon]:ml-auto *:not-nth-2:last:data-[slot=icon]:size-5 sm:*:not-nth-2:last:data-[slot=icon]:size-4",
	"*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 *:data-[slot=avatar]:[--avatar-radius:var(--radius-md)] sm:*:data-[slot=avatar]:size-6",
	"hover:bg-zinc-950/5 hover:*:data-[slot=icon]:fill-zinc-950",
	"dark:text-white dark:*:data-[slot=icon]:fill-zinc-400",
	"dark:hover:bg-white/5 dark:hover:*:data-[slot=icon]:fill-white",
);

const sidebarNavigationClasses = clsx(
	"flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-base/6 font-medium text-zinc-950 sm:py-2 sm:text-sm/5",
	"*:data-[slot=icon]:size-6 *:data-[slot=icon]:shrink-0 *:data-[slot=icon]:fill-zinc-500 sm:*:data-[slot=icon]:size-5",
	"*:last:data-[slot=icon]:ml-auto *:last:data-[slot=icon]:size-5 sm:*:last:data-[slot=icon]:size-4",
	"*:data-[slot=avatar]:-m-0.5 *:data-[slot=avatar]:size-7 sm:*:data-[slot=avatar]:size-6",
	"hover:bg-zinc-950/5 hover:*:data-[slot=icon]:fill-zinc-950",
	"dark:text-white dark:*:data-[slot=icon]:fill-zinc-400",
	"dark:hover:bg-white/5 dark:hover:*:data-[slot=icon]:fill-white",
);

function getNavigationStateClasses(activeState: NavigationItemActiveState) {
	if (activeState === "current") {
		return "bg-zinc-950/7 text-zinc-950 dark:bg-white/10 dark:text-white";
	}

	if (activeState === "ancestor") {
		return "bg-zinc-950/4 text-zinc-950/80 dark:bg-white/5 dark:text-white/80";
	}

	return "";
}

export function NavbarNavigationLink({
	activeState,
	children,
	href,
}: {
	activeState: NavigationItemActiveState;
	children: React.ReactNode;
	href: string;
}) {
	const isCurrent = activeState === "current";

	return (
		<span className="relative">
			{isCurrent ? (
				<motion.span
					layoutId="navbar-navigation-current-indicator"
					className="absolute inset-x-2 -bottom-2.5 h-0.5 rounded-full bg-zinc-950 dark:bg-white"
				/>
			) : null}
			<Link
				aria-current={isCurrent ? "page" : undefined}
				className={clsx(navbarNavigationClasses, getNavigationStateClasses(activeState))}
				data-active-state={activeState !== "inactive" ? activeState : undefined}
				href={href}
			>
				<TouchTarget>{children}</TouchTarget>
			</Link>
		</span>
	);
}

export function SidebarNavigationLink({
	activeState,
	children,
	href,
	onClick,
}: {
	activeState: NavigationItemActiveState;
	children: React.ReactNode;
	href: string;
	onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
	const isCurrent = activeState === "current";

	return (
		<span className="relative">
			{isCurrent ? (
				<motion.span
					layoutId="sidebar-navigation-current-indicator"
					className="absolute inset-y-2 -left-4 w-0.5 rounded-full bg-zinc-950 dark:bg-white"
				/>
			) : null}
			<Headless.CloseButton
				aria-current={isCurrent ? "page" : undefined}
				as={Link}
				className={clsx(sidebarNavigationClasses, getNavigationStateClasses(activeState))}
				data-active-state={activeState !== "inactive" ? activeState : undefined}
				href={href}
				onClick={onClick}
			>
				<TouchTarget>{children}</TouchTarget>
			</Headless.CloseButton>
		</span>
	);
}
