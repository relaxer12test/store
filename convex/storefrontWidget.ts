import { v } from "convex/values";
import type { StorefrontWidgetConfig } from "../src/shared/contracts/storefront-widget";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { getStorefrontConfigFallback } from "./storefrontWidgetRuntime";

function normalizeShopDomain(shopDomain: string) {
	return shopDomain.trim().toLowerCase();
}

export const getConfig = query({
	args: {
		shopDomain: v.string(),
	},
	handler: async (ctx, args): Promise<StorefrontWidgetConfig> => {
		const normalizedShopDomain = normalizeShopDomain(args.shopDomain);
		const context: { config: StorefrontWidgetConfig; shopId: Id<"shops"> | null } =
			await ctx.runQuery(internal.storefrontConcierge.getContext, {
				shopDomain: normalizedShopDomain,
			});

		return context.config ?? getStorefrontConfigFallback(normalizedShopDomain);
	},
});
