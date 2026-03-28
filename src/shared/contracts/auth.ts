export const viewerRoles = ["shop_admin", "shop_staff", "admin"] as const;

export type ViewerRole = (typeof viewerRoles)[number];

export interface ViewerSummary {
	id: string;
	name: string;
	email: string;
	initials: string;
	roles: ViewerRole[];
}

export interface ShopSummary {
	id: string;
	name: string;
	domain: string;
	installStatus: "pending" | "connected" | "inactive";
}

export interface AppViewerContext {
	authMode: "embedded" | "internal";
	viewer: ViewerSummary;
	activeShop: ShopSummary | null;
	roles: ViewerRole[];
}

export function deriveViewerRoles(input: {
	betterAuthRole?: string | null;
	merchantRole?: string | null;
}): ViewerRole[] {
	const roles = new Set<ViewerRole>();

	if (
		input.merchantRole === "shop_admin" ||
		input.merchantRole === "owner" ||
		input.merchantRole === "admin"
	) {
		roles.add("shop_admin");
	}

	if (input.merchantRole === "member" || input.merchantRole === "shop_staff") {
		roles.add("shop_staff");
	}

	if (input.betterAuthRole === "admin") {
		roles.add("admin");
	}

	return Array.from(roles);
}

export function hasAdminViewer(viewer: AppViewerContext | null | undefined) {
	return Boolean(viewer?.roles.includes("admin"));
}

export function hasMerchantViewer(viewer: AppViewerContext | null | undefined) {
	return Boolean(viewer?.authMode === "embedded" && viewer.activeShop);
}

export function hasMerchantAppAccess(viewer: AppViewerContext | null | undefined) {
	return Boolean(
		viewer?.activeShop && (viewer.authMode === "embedded" || viewer.roles.includes("admin")),
	);
}
