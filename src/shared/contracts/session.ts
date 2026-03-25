export const PREVIEW_COOKIE_NAME = "store-preview-session";

export const previewSessionModes = ["merchant", "internal"] as const;

export type PreviewSessionMode = (typeof previewSessionModes)[number];

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
	installStatus: "preview" | "connected" | "inactive";
}

export interface SessionEnvelope {
	authMode: "none" | "preview" | "embedded";
	state: "ready" | "offline";
	viewer: ViewerSummary | null;
	activeShop: ShopSummary | null;
	roles: ViewerRole[];
	convexToken: string | null;
}
