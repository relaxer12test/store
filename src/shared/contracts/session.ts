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

export interface SessionEnvelope {
	authMode: "none" | "embedded" | "internal";
	state: "ready" | "offline";
	viewer: ViewerSummary | null;
	activeShop: ShopSummary | null;
	roles: ViewerRole[];
	convexToken: string | null;
	convexTokenExpiresAt: number | null;
}

export function deriveViewerRoles(input: {
	betterAuthRole?: string | null;
	merchantRole?: string | null;
}): ViewerRole[] {
	const roles = new Set<ViewerRole>();

	if (input.merchantRole === "shop_admin" || input.merchantRole === "shop_staff") {
		roles.add(input.merchantRole);
	}

	if (input.betterAuthRole === "admin") {
		roles.add("admin");
	}

	return Array.from(roles);
}

export function hasEmbeddedMerchantSession(session: SessionEnvelope) {
	return (
		session.authMode === "embedded" &&
		session.state === "ready" &&
		Boolean(session.viewer && session.activeShop && session.convexToken)
	);
}

export function hasAdminSession(session: SessionEnvelope) {
	return (
		session.state === "ready" &&
		session.roles.includes("admin") &&
		Boolean(session.viewer && session.convexToken)
	);
}
