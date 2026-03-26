import type { ViewerRole } from "@/shared/contracts/session";

export const merchantOrganizationSchema = {
	organization: {
		additionalFields: {
			planDisplayName: {
				index: true,
				input: false,
				required: false,
				type: "string",
			},
			shopDomain: {
				index: true,
				input: false,
				required: true,
				type: "string",
				unique: true,
			},
			shopId: {
				index: true,
				input: false,
				required: true,
				type: "string",
				unique: true,
			},
			shopifyShopId: {
				index: true,
				input: false,
				required: false,
				type: "string",
			},
		},
	},
	member: {
		additionalFields: {
			initials: {
				input: false,
				required: false,
				type: "string",
			},
			lastAuthenticatedAt: {
				input: false,
				required: false,
				type: "number",
			},
			sessionId: {
				input: false,
				required: false,
				type: "string",
			},
			shopifyUserId: {
				index: true,
				input: false,
				required: true,
				type: "string",
			},
		},
	},
} as const;

export function getShopOrganizationSlug(shopDomain: string) {
	const normalized = shopDomain
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return normalized.length > 0 ? normalized : "shop";
}

export function mapMerchantMemberRoleToViewerRole(
	role: string | null | undefined,
): ViewerRole | null {
	if (role === "owner" || role === "admin") {
		return "shop_admin";
	}

	if (role === "member") {
		return "shop_staff";
	}

	return null;
}
