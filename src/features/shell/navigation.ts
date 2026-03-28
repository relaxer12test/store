export interface ShellNavigationItem {
	href: string;
	label: string;
	adminOnly?: boolean;
}

const shellNavigationItems: readonly ShellNavigationItem[] = [
	{
		href: "/",
		label: "Marketing",
	},
	{
		href: "/install",
		label: "Install",
	},
	{
		href: "/app",
		label: "Merchant app",
	},
	{
		adminOnly: true,
		href: "/internal",
		label: "Internal",
	},
];

export function getShellNavigationItems(showInternalNav: boolean) {
	return shellNavigationItems.filter((item) => showInternalNav || !item.adminOnly);
}
