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
			role: "admin",
			userId: "actor_1",
		} as any;
		const ctx = {
			auth: {
				getUserIdentity: async () => identity,
			},
			db: {
				get: async (id: string) => {
					if (id === "actor_1") {
						return {
							_id: "actor_1",
							shopDomain: "acme.myshopify.com",
							shopId: "shop_1",
							shopifyUserId: "shopify-user-1",
						};
					}

					return {
						_id: "shop_1",
						domain: "acme.myshopify.com",
						installStatus: "connected",
					};
				},
			},
		} as any;

		const context = await requireMerchantActor(ctx);
		const claims = await requireMerchantClaims(ctx);

		expect(context.actor._id).toBe("actor_1");
		expect(context.shop._id).toBe("shop_1");
		expect(context.roles).toEqual(["shop_admin", "admin"]);
		expect(claims).toEqual({
			merchantActorId: "actor_1",
			roles: ["shop_admin", "admin"],
			shopDomain: "acme.myshopify.com",
			shopId: "shop_1",
			shopifyUserId: "shopify-user-1",
		});
	});

	it("rejects inactive merchant shops", async () => {
		const ctx = {
			auth: {
				getUserIdentity: async () =>
					({
						userId: "actor_1",
					}) as any,
			},
			db: {
				get: async (id: string) => {
					if (id === "actor_1") {
						return {
							_id: "actor_1",
							shopDomain: "acme.myshopify.com",
							shopId: "shop_1",
							shopifyUserId: "shopify-user-1",
						};
					}

					return {
						_id: "shop_1",
						domain: "acme.myshopify.com",
						installStatus: "inactive",
					};
				},
			},
		} as any;

		await expect(requireMerchantActor(ctx)).rejects.toThrow(
			"The authenticated shop is not currently connected.",
		);
	});
});
