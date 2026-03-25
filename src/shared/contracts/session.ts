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
	authMode: "none" | "embedded";
	state: "ready" | "offline";
	viewer: ViewerSummary | null;
	activeShop: ShopSummary | null;
	roles: ViewerRole[];
	convexToken: string | null;
}
