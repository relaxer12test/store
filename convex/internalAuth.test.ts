import { describe, expect, it } from "vitest";
import { hasInternalStaffRole, requireInternalStaff } from "./internalAuth";

describe("internalAuth", () => {
	it("recognizes the internal staff role from Convex identity claims", () => {
		expect(
			hasInternalStaffRole({
				roles: ["internal_staff"],
			} as any),
		).toBe(true);
		expect(
			hasInternalStaffRole({
				roles: ["shop_admin"],
			} as any),
		).toBe(false);
	});

	it("rejects non-staff identities", async () => {
		const ctx = {
			auth: {
				getUserIdentity: async () =>
					({
						roles: ["shop_admin"],
					}) as any,
			},
		} as any;

		await expect(requireInternalStaff(ctx)).rejects.toThrow(
			"Internal diagnostics require an authenticated staff session.",
		);
	});
});
