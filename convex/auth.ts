import { createClient } from "@convex-dev/better-auth";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import { convex as betterAuthConvexPlugin } from "@convex-dev/better-auth/plugins";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { admin } from "better-auth/plugins/admin";
import type { UserIdentity } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";
import { components, internal } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import {
	internalQuery,
	query,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx,
} from "./_generated/server";
import authSchema from "./betterAuth/schema";

type AuthCtx = ActionCtx | MutationCtx | QueryCtx;
type AdminAuthCtx = Pick<AuthCtx, "auth">;
type MerchantDbCtx = QueryCtx | MutationCtx;

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

interface MerchantLookup {
	actor: Doc<"merchantActors">;
	shop: Doc<"shops">;
}

interface BetterAuthUserRecord {
	createdAt: Date;
	email: string;
	emailVerified?: boolean | null;
	id: string;
	image?: string | null;
	name: string;
	role?: string | null;
	updatedAt: Date;
	userId?: string | null;
}

interface ShopifyMerchantBridgeBody {
	email?: string;
	merchantActorId: string;
	name: string;
	shopDomain: string;
	shopifyUserId: string;
}

const DEFAULT_AUTH_BASE_URL = "https://example.invalid";
const DEFAULT_AUTH_SECRET = "development-only-better-auth-secret-32";
const SHOPIFY_MERCHANT_BRIDGE_PATH = "/sign-in/shopify-bridge";
const SHOPIFY_MERCHANT_BRIDGE_PROVIDER_ID = "shopify-merchant";
const SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER = "x-shopify-bridge-secret";

function sanitizeEmailPart(value: string) {
	const sanitized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);

	return sanitized.length > 0 ? sanitized : "merchant";
}

function buildMerchantBetterAuthEmail({
	shopDomain,
	shopifyUserId,
}: {
	shopDomain: string;
	shopifyUserId: string;
}) {
	return `${sanitizeEmailPart(shopDomain)}--${sanitizeEmailPart(shopifyUserId)}@shopify.local`;
}

function buildMerchantBridgeAccountId({
	shopDomain,
	shopifyUserId,
}: {
	shopDomain: string;
	shopifyUserId: string;
}) {
	return `${shopDomain.trim().toLowerCase()}:${shopifyUserId.trim()}`;
}

function isSyntheticMerchantEmail(email: string | null | undefined) {
	return typeof email === "string" && email.toLowerCase().endsWith("@shopify.local");
}

function normalizeBetterAuthEmail(email: string | null | undefined) {
	const normalized = email?.trim().toLowerCase();

	return normalized && normalized.length > 0 ? normalized : null;
}

function getProcessEnv(name: string) {
	return (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env?.[name];
}

function getOptionalEnv(name: string) {
	return getProcessEnv(name)?.trim() || undefined;
}

function getAuthBaseUrl() {
	return getOptionalEnv("SHOPIFY_APP_URL") ?? DEFAULT_AUTH_BASE_URL;
}

function getAuthSecret() {
	return getOptionalEnv("BETTER_AUTH_SECRET") ?? DEFAULT_AUTH_SECRET;
}

function getMerchantBridgeRole({
	currentRole,
	existingUsers,
	userId,
}: {
	currentRole?: string | null;
	existingUsers: Array<{
		id: string;
	}>;
	userId: string;
}) {
	if (currentRole === "admin") {
		return "admin";
	}

	const otherUsers = existingUsers.filter((user) => user.id !== userId);

	return otherUsers.length === 0 ? "admin" : "user";
}

function toSessionUser(user: BetterAuthUserRecord) {
	return {
		...user,
		emailVerified: user.emailVerified ?? false,
	};
}

function getIdentityRoles(identity: UserIdentity | null) {
	const roles = identity?.roles;

	if (!Array.isArray(roles)) {
		return [];
	}

	return roles.filter((role): role is string => typeof role === "string");
}

function getIdentityRole(identity: UserIdentity | null) {
	return typeof identity?.role === "string" ? identity.role : null;
}

function getMerchantActorId(identity: UserIdentity | null) {
	if (typeof identity?.userId !== "string" || identity.userId.length === 0) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	return identity.userId as Id<"merchantActors">;
}

function getMerchantRoles(identity: UserIdentity) {
	return hasAdminIdentity(identity) ? ["shop_admin", "admin"] : ["shop_admin"];
}

export function hasAdminIdentity(identity: UserIdentity | null) {
	return getIdentityRole(identity) === "admin" || getIdentityRoles(identity).includes("admin");
}

async function readMerchantContextFromDb(
	ctx: Pick<MerchantDbCtx, "db">,
	merchantActorId: Id<"merchantActors">,
): Promise<MerchantLookup> {
	const actor = await ctx.db.get(merchantActorId);

	if (!actor) {
		throw new Error("Authenticated merchant actor could not be found.");
	}

	const shop = await ctx.db.get(actor.shopId);

	if (!shop) {
		throw new Error("Authenticated shop could not be found.");
	}

	if (actor.shopDomain !== shop.domain) {
		throw new Error("Authenticated merchant actor does not match the resolved shop domain.");
	}

	if (shop.installStatus !== "connected") {
		throw new Error("The authenticated shop is not currently connected.");
	}

	return {
		actor,
		shop,
	};
}

function shopifyMerchantBridgePlugin() {
	return {
		id: "shopify-merchant-bridge",
		endpoints: {
			signInShopifyBridge: createAuthEndpoint(
				SHOPIFY_MERCHANT_BRIDGE_PATH,
				{
					body: z.object({
						email: z.string().optional(),
						merchantActorId: z.string(),
						name: z.string(),
						shopDomain: z.string(),
						shopifyUserId: z.string(),
					}),
					method: "POST",
				},
				async (ctx) => {
					const bridgeSecret = ctx.headers?.get(SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER);

					if (bridgeSecret !== ctx.context.secret) {
						throw new APIError("UNAUTHORIZED", {
							message: "Invalid merchant bridge request.",
						});
					}

					const body = ctx.body as ShopifyMerchantBridgeBody;
					const normalizedEmail = normalizeBetterAuthEmail(body.email ?? null);
					const accountId = buildMerchantBridgeAccountId({
						shopDomain: body.shopDomain,
						shopifyUserId: body.shopifyUserId,
					});
					const linkedAccount = await ctx.context.internalAdapter.findAccountByProviderId(
						accountId,
						SHOPIFY_MERCHANT_BRIDGE_PROVIDER_ID,
					);
					const accountUser = linkedAccount
						? ((await ctx.context.internalAdapter.findUserById(
								linkedAccount.userId,
							)) as BetterAuthUserRecord | null)
						: null;
					const merchantLinkedUser = (await ctx.context.adapter.findOne({
						model: "user",
						where: [
							{
								field: "userId",
								value: body.merchantActorId,
							},
						],
					})) as BetterAuthUserRecord | null;
					const emailUserMatch = normalizedEmail
						? await ctx.context.internalAdapter.findUserByEmail(normalizedEmail, {
								includeAccounts: true,
							})
						: null;
					const emailUser = (emailUserMatch?.user ?? null) as BetterAuthUserRecord | null;

					let targetUser = accountUser;

					if (!targetUser && emailUser) {
						const shouldPreferEmailUser =
							!merchantLinkedUser ||
							emailUser.role === "admin" ||
							isSyntheticMerchantEmail(merchantLinkedUser.email);

						if (shouldPreferEmailUser) {
							targetUser = emailUser;
						}
					}

					targetUser ??= merchantLinkedUser;

					const resolvedEmail =
						normalizedEmail ??
						targetUser?.email ??
						buildMerchantBetterAuthEmail({
							shopDomain: body.shopDomain,
							shopifyUserId: body.shopifyUserId,
						});

					let createdNewUser = false;

					if (!targetUser) {
						const createdUser = await ctx.context.internalAdapter.createOAuthUser(
							{
								email: resolvedEmail,
								emailVerified: Boolean(normalizedEmail),
								name: body.name,
							},
							{
								accountId,
								providerId: SHOPIFY_MERCHANT_BRIDGE_PROVIDER_ID,
							},
						);

						targetUser = createdUser.user as BetterAuthUserRecord;
						createdNewUser = true;
					}

					if (linkedAccount && linkedAccount.userId !== targetUser.id) {
						await ctx.context.internalAdapter.updateAccount(linkedAccount.id, {
							userId: targetUser.id,
						});
					} else if (!linkedAccount && !createdNewUser) {
						await ctx.context.internalAdapter.linkAccount({
							accountId,
							providerId: SHOPIFY_MERCHANT_BRIDGE_PROVIDER_ID,
							userId: targetUser.id,
						});
					}

					const existingUsers = (await ctx.context.adapter.findMany({
						limit: 2,
						model: "user",
					})) as Array<{
						id: string;
					}>;

					targetUser = (await ctx.context.internalAdapter.updateUser(targetUser.id, {
						email: resolvedEmail,
						emailVerified: normalizedEmail ? true : (targetUser.emailVerified ?? false),
						name: body.name,
						role: getMerchantBridgeRole({
							currentRole: targetUser.role,
							existingUsers,
							userId: targetUser.id,
						}),
						userId: body.merchantActorId,
					})) as BetterAuthUserRecord;

					if (
						merchantLinkedUser &&
						merchantLinkedUser.id !== targetUser.id &&
						isSyntheticMerchantEmail(merchantLinkedUser.email) &&
						merchantLinkedUser.role !== "admin"
					) {
						await ctx.context.internalAdapter.deleteUser(merchantLinkedUser.id);
					}

					const session = await ctx.context.internalAdapter.createSession(targetUser.id);

					if (!session) {
						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Failed to create merchant session.",
						});
					}

					await setSessionCookie(ctx, {
						session,
						user: toSessionUser(targetUser),
					});

					return ctx.json({
						token: session.token,
						user: {
							email: targetUser.email,
							id: targetUser.id,
							name: targetUser.name,
							role: targetUser.role ?? null,
						},
					});
				},
			),
		},
	};
}

export const betterAuthProvider = getAuthConfigProvider({
	basePath: "/api/auth",
	jwks: getOptionalEnv("BETTER_AUTH_JWKS"),
});

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
	local: {
		schema: authSchema,
	},
});

export function createAuthOptions(ctx: AuthCtx) {
	return {
		basePath: "/api/auth",
		baseURL: getAuthBaseUrl(),
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [
			admin(),
			shopifyMerchantBridgePlugin(),
			betterAuthConvexPlugin({
				authConfig: {
					providers: [betterAuthProvider],
				},
				jwks: getOptionalEnv("BETTER_AUTH_JWKS"),
				options: {
					basePath: "/api/auth",
				},
			}),
		],
		secret: getAuthSecret(),
		trustedOrigins: [getAuthBaseUrl()],
	} satisfies BetterAuthOptions;
}

export const createAuth = (ctx: AuthCtx) => betterAuth(createAuthOptions(ctx));

export async function requireAdmin(ctx: AdminAuthCtx) {
	const identity = await ctx.auth.getUserIdentity();

	if (!hasAdminIdentity(identity)) {
		throw new Error("Internal diagnostics require an authenticated admin session.");
	}

	return identity;
}

export const readMerchantContext = internalQuery({
	args: {
		merchantActorId: v.id("merchantActors"),
	},
	handler: async (ctx, args): Promise<MerchantLookup> => {
		return await readMerchantContextFromDb(ctx, args.merchantActorId);
	},
});

export async function requireMerchantClaims(ctx: AuthCtx): Promise<MerchantClaims> {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	const merchantActorId = getMerchantActorId(identity);
	const resolved: MerchantLookup =
		"db" in ctx
			? await readMerchantContextFromDb(ctx, merchantActorId)
			: await ctx.runQuery(internal.auth.readMerchantContext, {
					merchantActorId,
				});

	return {
		merchantActorId: resolved.actor._id,
		roles: getMerchantRoles(identity),
		shopDomain: resolved.shop.domain,
		shopId: resolved.shop._id,
		shopifyUserId: resolved.actor.shopifyUserId,
	};
}

export async function requireMerchantActor(ctx: MerchantDbCtx): Promise<MerchantContext> {
	const identity = await ctx.auth.getUserIdentity();

	if (!identity) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	const resolved = await readMerchantContextFromDb(ctx, getMerchantActorId(identity));

	return {
		actor: resolved.actor,
		identity,
		roles: getMerchantRoles(identity),
		shop: resolved.shop,
	};
}

export const getCurrentViewer = query({
	args: {},
	handler: async (ctx) => {
		const user = (await authComponent.safeGetAuthUser(ctx)) as BetterAuthUserRecord | undefined;

		if (!user) {
			return null;
		}

		const betterAuthRole = user.role ?? null;
		const merchantActorId =
			typeof user.userId === "string" && user.userId.length > 0 ? user.userId : null;

		if (merchantActorId) {
			const actor = await ctx.db.get(merchantActorId as Id<"merchantActors">);

			if (!actor) {
				return null;
			}

			const shop = await ctx.db.get(actor.shopId);

			if (!shop) {
				return null;
			}

			return {
				authKind: "merchant" as const,
				betterAuthRole,
				contactEmail: user.email,
				email: user.email,
				merchantActorId: actor._id,
				merchantRole: "shop_admin" as const,
				name: user.name,
				shopDomain: shop.domain,
				shopId: shop._id,
				shopName: shop.name,
				shopifyUserId: actor.shopifyUserId,
				userId: actor._id,
			};
		}

		if (betterAuthRole === "admin") {
			return {
				authKind: "admin" as const,
				betterAuthRole,
				contactEmail: user.email,
				email: user.email,
				merchantActorId: null,
				merchantRole: null,
				name: user.name,
				shopDomain: null,
				shopId: null,
				shopName: null,
				shopifyUserId: null,
				userId: user.id,
			};
		}

		return null;
	},
});
