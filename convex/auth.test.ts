import { describe, expect, it, vi } from "vitest";
import {
	authComponent,
	buildPasswordResetLink,
	getTrustedAuthOrigins,
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
		const safeGetAuthUserSpy = vi
			.spyOn(authComponent, "safeGetAuthUser")
			.mockResolvedValue(undefined as any);

		await expect(requireAdmin(ctx)).rejects.toThrow(
			"Internal diagnostics require an authenticated admin session.",
		);
		safeGetAuthUserSpy.mockRestore();
	});

	it("accepts native Better Auth admin users without a Convex identity role", async () => {
		const ctx = {
			auth: {
				getUserIdentity: async () => null,
			},
		} as any;
		const safeGetAuthUserSpy = vi.spyOn(authComponent, "safeGetAuthUser").mockResolvedValue({
			role: "admin",
		} as any);

		await expect(requireAdmin(ctx)).resolves.toBeNull();
		safeGetAuthUserSpy.mockRestore();
	});

	it("uses the callback URL directly for password reset emails", () => {
		expect(
			buildPasswordResetLink(
				"https://storeai.ldev.cloud/api/auth/reset-password/token_123?callbackURL=http%3A%2F%2Flocalhost%3A3001%2Finternal-reset-password%3Fnext%3Dusers",
				"token_123",
			),
		).toBe("http://localhost:3001/internal-reset-password?next=users&token=token_123");
	});

	it("keeps the original Better Auth reset URL when no callback URL is present", () => {
		expect(
			buildPasswordResetLink(
				"https://storeai.ldev.cloud/api/auth/reset-password/token_123",
				"token_123",
			),
		).toBe("https://storeai.ldev.cloud/api/auth/reset-password/token_123");
	});

	it("limits trusted Better Auth origins to the app domain and localhost", () => {
		expect(getTrustedAuthOrigins()).toEqual([
			"https://storeai.ldev.cloud",
			"http://localhost:3000",
			"http://localhost:3001",
		]);
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
