import { describe, expect, it } from "vitest";
import { getMerchantClaimsFromIdentity, requireMerchantActor } from "./merchantAuth";

const identity = {
	merchantActorId: "actor_1",
	roles: ["shop_admin"],
	shopDomain: "acme.myshopify.com",
	shopId: "shop_1",
	shopifyUserId: "shopify-user-1",
} as any;

describe("merchantAuth", () => {
	it("extracts merchant claims from the verified identity", () => {
		expect(getMerchantClaimsFromIdentity(identity)).toEqual({
			merchantActorId: "actor_1",
			roles: ["shop_admin"],
			shopDomain: "acme.myshopify.com",
			shopId: "shop_1",
			shopifyUserId: "shopify-user-1",
		});
	});

	it("resolves the active merchant actor and shop", async () => {
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

		const result = await requireMerchantActor(ctx);

		expect(result.actor._id).toBe("actor_1");
		expect(result.shop._id).toBe("shop_1");
		expect(result.roles).toEqual(["shop_admin"]);
	});

	it("rejects inactive shops", async () => {
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
