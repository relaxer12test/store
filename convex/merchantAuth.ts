import type { UserIdentity } from "convex/server";
import { api } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";

type MerchantDbCtx = QueryCtx | MutationCtx;
type MerchantAuthCtx = QueryCtx | MutationCtx | ActionCtx;

export interface MerchantClaims {
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

function getOptionalStringClaim(
	identity: UserIdentity,
	key: keyof MerchantClaims | "authKind" | "role" | "userId",
) {
	const value = identity[key];

	return typeof value === "string" && value.length > 0 ? value : null;
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

export function getMerchantClaimsFromIdentity(identity: UserIdentity): MerchantClaims {
	const explicitRoles =
		Array.isArray(identity.roles) && identity.roles.every((entry) => typeof entry === "string")
			? identity.roles
			: null;
	const singleRole = getOptionalStringClaim(identity, "role");
	const roles = explicitRoles ?? (singleRole ? [singleRole] : []);

	if (getOptionalStringClaim(identity, "authKind") === "internal") {
		throw new Error("Internal staff sessions cannot be used for merchant-scoped data.");
	}

	if (roles.length === 0) {
		throw new Error("Authenticated merchant token is missing the required `roles` claim.");
	}

	return {
		merchantActorId: (getOptionalStringClaim(identity, "merchantActorId") ??
			getOptionalStringClaim(identity, "userId") ??
			(() => {
				throw new Error(
					"Authenticated merchant token is missing the required `merchantActorId` claim.",
				);
			})()) as Id<"merchantActors">,
		roles,
		shopDomain: getStringClaim(identity, "shopDomain"),
		shopId: getStringClaim(identity, "shopId") as Id<"shops">,
		shopifyUserId: getStringClaim(identity, "shopifyUserId"),
	};
}

export async function requireMerchantClaims(ctx: MerchantAuthCtx): Promise<MerchantClaims> {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	try {
		return getMerchantClaimsFromIdentity(identity);
	} catch {
		const merchantActorId = getOptionalStringClaim(identity, "userId");

		if (!merchantActorId) {
			throw new Error(
				"Protected merchant data requires an authenticated embedded Shopify session.",
			);
		}

		const resolved = await ctx.runQuery(api.auth.resolveMerchantClaims, {
			merchantActorId: merchantActorId as Id<"merchantActors">,
		});

		if (!resolved) {
			throw new Error("Authenticated merchant actor could not be resolved from Better Auth.");
		}

		return {
			merchantActorId: resolved.merchantActorId,
			roles: [resolved.role],
			shopDomain: resolved.shopDomain,
			shopId: resolved.shopId,
			shopifyUserId: resolved.shopifyUserId,
		};
	}
}

export async function requireMerchantActor(ctx: MerchantDbCtx): Promise<MerchantContext> {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	const claims = getMerchantClaimsFromIdentity(identity);
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
