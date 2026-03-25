export const PREVIEW_COOKIE_NAME = "store-preview-session";

export const previewSessionModes = ["merchant", "ops"] as const;

export type PreviewSessionMode = (typeof previewSessionModes)[number];

export const viewerRoles = ["tenant_admin", "tenant_member", "platform_admin"] as const;

export type ViewerRole = (typeof viewerRoles)[number];

export interface ViewerSummary {
	id: string;
	name: string;
	email: string;
	initials: string;
	roles: ViewerRole[];
}

export interface TenantSummary {
	id: string;
	name: string;
	slug: string;
}

export interface ShopSummary {
	id: string;
	name: string;
	domain: string;
	installStatus: "preview" | "connected" | "inactive";
}

export interface SessionEnvelope {
	authMode: "none" | "preview";
	state: "ready" | "offline";
	viewer: ViewerSummary | null;
	activeTenant: TenantSummary | null;
	activeShop: ShopSummary | null;
	roles: ViewerRole[];
	convexToken: string | null;
}
