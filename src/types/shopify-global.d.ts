interface ShopifyGlobal {
	idToken: () => Promise<string>;
}

declare global {
	interface Window {
		shopify?: ShopifyGlobal;
	}

	var shopify: ShopifyGlobal | undefined;
}

export {};
