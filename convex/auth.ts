import { createClient } from "@convex-dev/better-auth";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import { convex as betterAuthConvexPlugin } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth";
import { v } from "convex/values";
import {
	buildMerchantBetterAuthEmail,
	buildMerchantBetterAuthPassword,
} from "../src/shared/auth/better-auth";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { DataModel } from "./_generated/dataModel";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import { action, query } from "./_generated/server";

const INTERNAL_USER_ID_PREFIX = "internal:";

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

function getRequiredEnv(name: string) {
	const value = getOptionalEnv(name);

	if (!value) {
		throw new Error(`Missing Convex environment variable ${name}.`);
	}

	return value;
}

function buildInternalUserId(email: string) {
	return `${INTERNAL_USER_ID_PREFIX}${email.trim().toLowerCase()}`;
}

function isInternalUserId(userId: string | null | undefined) {
	return typeof userId === "string" && userId.startsWith(INTERNAL_USER_ID_PREFIX);
}

export const betterAuthProvider = getAuthConfigProvider({
	basePath: "/api/auth",
	jwks: getOptionalEnv("BETTER_AUTH_JWKS"),
});

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: ActionCtx | QueryCtx) =>
	betterAuth({
		basePath: "/api/auth",
		baseURL: getRequiredEnv("SHOPIFY_APP_URL"),
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [
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
		secret: getRequiredEnv("BETTER_AUTH_SECRET"),
		trustedOrigins: [getRequiredEnv("SHOPIFY_APP_URL")],
	});

export async function ensureMerchantBetterAuthSession(
	ctx: ActionCtx,
	input: {
		contactEmail?: string;
		merchantActorId: Id<"merchantActors">;
		name: string;
		shopDomain: string;
		shopifyUserId: string;
	},
) {
	const auth = createAuth(ctx);
	const email = buildMerchantBetterAuthEmail({
		shopDomain: input.shopDomain,
		shopifyUserId: input.shopifyUserId,
	});
	const password = buildMerchantBetterAuthPassword({
		appSecret: getRequiredEnv("SHOPIFY_API_SECRET"),
		shopDomain: input.shopDomain,
		shopifyUserId: input.shopifyUserId,
	});
	const existingUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
		model: "user",
		where: [
			{
				field: "email",
				value: email,
			},
		],
	});

	if (existingUser) {
		await ctx.runMutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: "user",
				update: {
					email,
					name: input.name,
					userId: input.merchantActorId,
				},
				where: [
					{
						field: "_id",
						value: existingUser._id,
					},
				],
			},
		});
	}

	let session:
		| Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["signInEmail"]>>
		| Awaited<ReturnType<ReturnType<typeof createAuth>["api"]["signUpEmail"]>>;

	try {
		session = await auth.api.signInEmail({
			body: {
				email,
				password,
			},
		});
	} catch {
		session = await auth.api.signUpEmail({
			body: {
				email,
				name: input.name,
				password,
			},
		});
		await ctx.runMutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: "user",
				update: {
					userId: input.merchantActorId,
				},
				where: [
					{
						field: "_id",
						value: session.user.id,
					},
				],
			},
		});
	}

	const convexToken = await auth.api.getToken({
		headers: new Headers({
			Authorization: `Bearer ${session.token}`,
		}),
	});

	return {
		convexToken: convexToken.token,
		sessionToken: session.token,
		viewerEmail: input.contactEmail ?? email,
	};
}

export const ensureInternalStaffUser = action({
	args: {},
	handler: async (ctx) => {
		const email = getRequiredEnv("INTERNAL_AUTH_EMAIL");
		const password = getRequiredEnv("INTERNAL_AUTH_PASSWORD");
		const name = getOptionalEnv("INTERNAL_AUTH_NAME") ?? "Internal Staff";
		const existingUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
			model: "user",
			where: [
				{
					field: "email",
					value: email,
				},
			],
		});

		if (existingUser) {
			await ctx.runMutation(components.betterAuth.adapter.updateOne, {
				input: {
					model: "user",
					update: {
						email,
						name,
						userId: buildInternalUserId(email),
					},
					where: [
						{
							field: "_id",
							value: existingUser._id,
						},
					],
				},
			});

			return {
				ok: true,
			};
		}

		const auth = createAuth(ctx);
		await auth.api.signUpEmail({
			body: {
				email,
				name,
				password,
			},
		});
		await ctx.runMutation(components.betterAuth.adapter.updateOne, {
			input: {
				model: "user",
				update: {
					userId: buildInternalUserId(email),
				},
				where: [
					{
						field: "email",
						value: email,
					},
				],
			},
		});

		return {
			ok: true,
		};
	},
});

export const getCurrentViewer = query({
	args: {},
	handler: async (ctx) => {
		const user = await authComponent.safeGetAuthUser(ctx);

		if (!user) {
			return null;
		}

		if (isInternalUserId(user.userId)) {
			return {
				authKind: "internal" as const,
				contactEmail: user.email,
				email: user.email,
				isInternalStaff: true,
				merchantActorId: null,
				name: user.name,
				role: "internal_staff" as const,
				shopDomain: null,
				shopId: null,
				shopName: null,
				shopifyUserId: null,
				userId: user.userId,
			};
		}

		if (!user.userId) {
			return null;
		}

		const actor = await ctx.db.get(user.userId as Id<"merchantActors">);

		if (!actor) {
			return null;
		}

		const shop = await ctx.db.get(actor.shopId);

		if (!shop) {
			return null;
		}

		return {
			authKind: "merchant" as const,
			contactEmail: user.email,
			email: user.email,
			isInternalStaff: false,
			merchantActorId: actor._id,
			name: user.name,
			role: "shop_admin" as const,
			shopDomain: shop.domain,
			shopId: shop._id,
			shopName: shop.name,
			shopifyUserId: actor.shopifyUserId,
			userId: actor._id,
		};
	},
});

export const resolveMerchantClaims = query({
	args: {
		merchantActorId: v.id("merchantActors"),
	},
	handler: async (ctx, args) => {
		const actor = await ctx.db.get(args.merchantActorId);

		if (!actor) {
			return null;
		}

		const shop = await ctx.db.get(actor.shopId);

		if (!shop) {
			return null;
		}

		return {
			merchantActorId: actor._id,
			role: "shop_admin" as const,
			shopDomain: shop.domain,
			shopId: shop._id,
			shopifyUserId: actor.shopifyUserId,
		};
	},
});
