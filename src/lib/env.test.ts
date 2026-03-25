import { describe, expect, it } from "vitest";
import { toConvexHttpUrl } from "./env";

describe("toConvexHttpUrl", () => {
	it("maps Convex cloud deployments to the HTTP actions host", () => {
		expect(toConvexHttpUrl("https://robust-bulldog-269.convex.cloud")).toBe(
			"https://robust-bulldog-269.convex.site/",
		);
	});

	it("preserves non-Convex hosts for local or self-hosted runtimes", () => {
		expect(toConvexHttpUrl("http://127.0.0.1:3210/api")).toBe("http://127.0.0.1:3210/");
	});
});
