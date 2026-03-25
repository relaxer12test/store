import type { ViewerRole } from "../contracts/session";

function sanitizeEmailPart(value: string) {
	const sanitized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);

	return sanitized.length > 0 ? sanitized : "merchant";
}

export function buildMerchantBetterAuthEmail({
	shopDomain,
	shopifyUserId,
}: {
	shopDomain: string;
	shopifyUserId: string;
}) {
	return `${sanitizeEmailPart(shopDomain)}--${sanitizeEmailPart(shopifyUserId)}@shopify.local`;
}

export function buildMerchantBetterAuthPassword({
	appSecret,
	shopDomain,
	shopifyUserId,
}: {
	appSecret: string;
	shopDomain: string;
	shopifyUserId: string;
}) {
	return `shopify:${shopDomain}:${shopifyUserId}:${appSecret}`;
}

export function deriveViewerRoles(input: {
	isInternalStaff?: boolean | null;
	role?: string | null;
}): ViewerRole[] {
	const roles = new Set<ViewerRole>();

	if (
		input.role === "shop_admin" ||
		input.role === "shop_staff" ||
		input.role === "internal_staff"
	) {
		roles.add(input.role);
	}

	if (input.isInternalStaff) {
		roles.add("internal_staff");
	}

	return Array.from(roles);
}
