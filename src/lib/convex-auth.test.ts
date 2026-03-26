import { describe, expect, it } from "vitest";
import { getConvexTokenExpiresAt, hasFreshConvexToken } from "@/lib/convex-auth";

function createJwt(payload: Record<string, unknown>) {
	return [
		Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }), "utf8").toString("base64url"),
		Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"),
		"signature",
	].join(".");
}

describe("convex auth helpers", () => {
	it("reads the JWT expiry in milliseconds", () => {
		const expiresAtSeconds = 2_000_000_000;

		expect(getConvexTokenExpiresAt(createJwt({ exp: expiresAtSeconds }))).toBe(
			expiresAtSeconds * 1000,
		);
	});

	it("treats a token without expiry metadata as usable until Convex forces a refresh", () => {
		expect(
			hasFreshConvexToken({
				convexToken: "opaque-token",
				convexTokenExpiresAt: null,
			}),
		).toBe(true);
	});

	it("rejects expired tokens when expiry metadata is present", () => {
		expect(
			hasFreshConvexToken(
				{
					convexToken: "expired-token",
					convexTokenExpiresAt: Date.now() - 1000,
				},
				{
					refreshBufferMs: 0,
				},
			),
		).toBe(false);
	});
});
