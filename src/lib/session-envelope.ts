import { getConvexTokenExpiresAt } from "@/lib/convex-auth";
import type { SessionEnvelope } from "@/shared/contracts/session";
import { deriveViewerRoles } from "@/shared/contracts/session";

export interface CurrentViewerPayload {
	authKind: "admin" | "merchant";
	betterAuthRole: string | null;
	contactEmail: string | null;
	email: string;
	merchantRole: string | null;
	name: string;
	organizationId: string | null;
	shopDomain: string | null;
	shopId: string | null;
	shopName: string | null;
	shopifyUserId: string | null;
	userId: string;
}

export const guestSession: SessionEnvelope = {
	authMode: "none",
	state: "ready",
	viewer: null,
	activeShop: null,
	roles: [],
	convexToken: null,
	convexTokenExpiresAt: null,
};

function getInitials(name: string) {
	const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

	if (words.length === 0) {
		return "IS";
	}

	return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

export function buildSessionEnvelopeFromViewer(
	viewer: CurrentViewerPayload | null,
	token: string,
): SessionEnvelope | null {
	if (!viewer) {
		return null;
	}

	const roles = deriveViewerRoles({
		betterAuthRole: viewer.betterAuthRole,
		merchantRole: viewer.merchantRole,
	});
	const viewerSummary = {
		email: viewer.contactEmail ?? viewer.email,
		id: String(viewer.userId),
		initials: getInitials(viewer.name),
		name: viewer.name,
		roles,
	};
	const convexTokenExpiresAt = getConvexTokenExpiresAt(token);

	if (viewer.authKind === "merchant" && viewer.shopDomain && viewer.shopId) {
		return {
			authMode: "embedded",
			state: "ready",
			viewer: viewerSummary,
			activeShop: {
				domain: viewer.shopDomain,
				id: viewer.shopId,
				installStatus: "connected",
				name: viewer.shopName ?? viewer.shopDomain,
			},
			roles,
			convexToken: token,
			convexTokenExpiresAt,
		};
	}

	if (viewer.authKind === "admin") {
		return {
			authMode: "internal",
			state: "ready",
			viewer: viewerSummary,
			activeShop: null,
			roles,
			convexToken: token,
			convexTokenExpiresAt,
		};
	}

	return null;
}
