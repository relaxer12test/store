export const viewerRoles = ["shop_admin", "shop_staff", "internal_staff"] as const;

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

export function hasEmbeddedMerchantSession(session: SessionEnvelope) {
	return (
		session.authMode === "embedded" &&
		session.state === "ready" &&
		Boolean(session.viewer && session.activeShop && session.convexToken)
	);
}

export function hasInternalStaffSession(session: SessionEnvelope) {
	return (
		session.authMode === "internal" &&
		session.state === "ready" &&
		session.roles.includes("internal_staff") &&
		Boolean(session.viewer && session.convexToken)
	);
}
