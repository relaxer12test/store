import { describe, expect, it } from "vitest";
import {
	hasAdminIdentity,
	requireAdmin,
	requireMerchantActor,
	requireMerchantClaims,
} from "./auth";

describe("auth", () => {
	it("recognizes native Better Auth admin users", () => {
		expect(
			hasAdminIdentity({
				role: "admin",
			} as any),
		).toBe(true);
		expect(
			hasAdminIdentity({
				roles: ["shop_admin"],
			} as any),
		).toBe(false);
	});

	it("rejects non-admin identities from internal routes", async () => {
		const ctx = {
			auth: {
				getUserIdentity: async () =>
					({
						roles: ["shop_admin"],
					}) as any,
			},
		} as any;

		await expect(requireAdmin(ctx)).rejects.toThrow(
			"Internal diagnostics require an authenticated admin session.",
		);
	});

	it("resolves the active merchant actor and shop from the Better Auth userId link", async () => {
		const identity = {
			activeOrganizationId: "org_1",
			role: "admin",
			sessionId: "session_1",
			subject: "user_1",
		} as any;
		const ctx = {
			auth: {
				getUserIdentity: async () => identity,
			},
			db: {
				get: async () => {
					return {
						_id: "shop_1",
						domain: "acme.myshopify.com",
						installStatus: "connected",
					};
				},
			},
			runQuery: async (_ref: unknown, args: { model: string }) => {
				switch (args.model) {
					case "session":
						return {
							_id: "session_1",
							activeOrganizationId: "org_1",
						};
					case "user":
						return {
							_id: "user_1",
							email: "merchant@example.com",
							name: "Jane Doe",
							role: "admin",
						};
					case "organization":
						return {
							_id: "org_1",
							shopDomain: "acme.myshopify.com",
							shopId: "shop_1",
						};
					case "member":
						return {
							_id: "member_1",
							organizationId: "org_1",
							role: "owner",
							shopifyUserId: "shopify-user-1",
							userId: "user_1",
						};
					default:
						return null;
				}
			},
		} as any;

		const context = await requireMerchantActor(ctx);
		const claims = await requireMerchantClaims(ctx);

		expect(context.actor.id).toBe("member_1");
		expect(context.shop._id).toBe("shop_1");
		expect(context.roles).toEqual(["shop_admin", "admin"]);
		expect(claims).toEqual({
			actorId: "member_1",
			organizationId: "org_1",
			roles: ["shop_admin", "admin"],
			shopDomain: "acme.myshopify.com",
			shopId: "shop_1",
			shopifyUserId: "shopify-user-1",
			userId: "user_1",
		});
	});

	it("rejects inactive merchant shops", async () => {
		const ctx = {
			auth: {
				getUserIdentity: async () =>
					({
						activeOrganizationId: "org_1",
						sessionId: "session_1",
						subject: "user_1",
					}) as any,
			},
			db: {
				get: async () =>
					({
						_id: "shop_1",
						domain: "acme.myshopify.com",
						installStatus: "inactive",
					}) as any,
			},
			runQuery: async (_ref: unknown, args: { model: string }) => {
				switch (args.model) {
					case "session":
						return {
							_id: "session_1",
							activeOrganizationId: "org_1",
						};
					case "user":
						return {
							_id: "user_1",
							email: "merchant@example.com",
							name: "Jane Doe",
						};
					case "organization":
						return {
							_id: "org_1",
							shopDomain: "acme.myshopify.com",
							shopId: "shop_1",
						};
					case "member":
						return {
							_id: "member_1",
							organizationId: "org_1",
							role: "owner",
							shopifyUserId: "shopify-user-1",
							userId: "user_1",
						};
					default:
						return null;
				}
			},
		} as any;

		await expect(requireMerchantActor(ctx)).rejects.toThrow(
			"The authenticated shop is not currently connected.",
		);
	});
});
