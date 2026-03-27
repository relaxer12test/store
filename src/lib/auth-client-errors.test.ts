import { describe, expect, it } from "vitest";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";

describe("getAuthClientErrorMessage", () => {
	it("prefers the explicit Better Auth error message", () => {
		expect(
			getAuthClientErrorMessage(
				{
					message: "Invalid email or password",
					statusText: "Unauthorized",
				},
				"Authentication failed.",
			),
		).toBe("Invalid email or password");
	});

	it("falls back to the status text when the message is missing", () => {
		expect(
			getAuthClientErrorMessage(
				{
					status: 404,
					statusText: "Not Found",
				},
				"Failed to send reset link.",
			),
		).toBe("Not Found");
	});

	it("uses the provided fallback when Better Auth returns no readable details", () => {
		expect(
			getAuthClientErrorMessage(
				{
					status: 404,
				},
				"Failed to send reset link.",
			),
		).toBe("Request failed with status 404.");
		expect(getAuthClientErrorMessage(null, "Failed to send reset link.")).toBe(
			"Failed to send reset link.",
		);
	});
});
