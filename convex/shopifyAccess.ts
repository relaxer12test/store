export function hasConnectedShopifyAccess(input: {
	installation: {
		accessToken?: string | null;
		status?: string | null;
	} | null;
	shop: {
		installStatus: string;
	};
}) {
	return (
		input.shop.installStatus === "connected" &&
		input.installation?.status === "connected" &&
		Boolean(input.installation.accessToken)
	);
}

export function getShopifyAccessFailureReason(input: {
	actionLabel: string;
	installation: {
		accessToken?: string | null;
		status?: string | null;
	} | null;
	shop: {
		domain: string;
		installStatus: string;
	};
}) {
	if (input.shop.installStatus !== "connected") {
		return `Cannot ${input.actionLabel} for ${input.shop.domain} because the shop is no longer connected.`;
	}

	if (input.installation?.status !== "connected" || !input.installation.accessToken) {
		return `Cannot ${input.actionLabel} for ${input.shop.domain} because the offline Shopify Admin token is unavailable.`;
	}

	return null;
}
