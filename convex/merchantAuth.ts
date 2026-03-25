import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

type MerchantDbCtx = QueryCtx | MutationCtx;

interface MerchantClaims {
	merchantActorId: Id<"merchantActors">;
	roles: string[];
	shopDomain: string;
	shopId: Id<"shops">;
	shopifyUserId: string;
}

export interface MerchantContext {
	actor: Doc<"merchantActors">;
	identity: UserIdentity;
	roles: string[];
	shop: Doc<"shops">;
}

function getStringClaim(identity: UserIdentity, key: keyof MerchantClaims) {
	const value = identity[key];

	if (typeof value !== "string" || value.length === 0) {
		throw new Error(
			`Authenticated merchant token is missing the required \`${String(key)}\` claim.`,
		);
	}

	return value;
}

function getStringArrayClaim(identity: UserIdentity, key: keyof MerchantClaims) {
	const value = identity[key];

	if (
		!Array.isArray(value) ||
		!value.every((entry): entry is string => typeof entry === "string")
	) {
		throw new Error(
			`Authenticated merchant token is missing the required \`${String(key)}\` claim.`,
		);
	}

	return value;
}

function getMerchantClaims(identity: UserIdentity): MerchantClaims {
	return {
		merchantActorId: getStringClaim(identity, "merchantActorId") as Id<"merchantActors">,
		roles: getStringArrayClaim(identity, "roles"),
		shopDomain: getStringClaim(identity, "shopDomain"),
		shopId: getStringClaim(identity, "shopId") as Id<"shops">,
		shopifyUserId: getStringClaim(identity, "shopifyUserId"),
	};
}

export async function requireMerchantActor(ctx: MerchantDbCtx): Promise<MerchantContext> {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	const claims = getMerchantClaims(identity);
	const actor = await ctx.db.get(claims.merchantActorId);

	if (!actor) {
		throw new Error("Authenticated merchant actor could not be found.");
	}

	const shop = await ctx.db.get(claims.shopId);

	if (!shop) {
		throw new Error("Authenticated shop could not be found.");
	}

	if (actor.shopId !== shop._id) {
		throw new Error("Authenticated merchant actor is not scoped to the resolved shop.");
	}

	if (actor.shopifyUserId !== claims.shopifyUserId) {
		throw new Error("Authenticated merchant actor does not match the verified Shopify user.");
	}

	if (shop.domain !== claims.shopDomain || actor.shopDomain !== claims.shopDomain) {
		throw new Error("Authenticated merchant actor does not match the verified shop domain.");
	}

	if (shop.installStatus !== "connected") {
		throw new Error("The authenticated shop is not currently connected.");
	}

	return {
		actor,
		identity,
		roles: claims.roles,
		shop,
	};
}

export async function requireShopContext(ctx: MerchantDbCtx) {
	return requireMerchantActor(ctx);
}
