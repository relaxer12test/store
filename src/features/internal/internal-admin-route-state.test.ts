import { describe, expect, it } from "vitest";
import {
	validateInternalAiSessionDetailSearch,
	validateInternalShopsSearch,
	validateInternalUsersSearch,
} from "@/features/internal/internal-admin-route-state";

describe("internal-admin-route-state", () => {
	it("normalizes shop search defaults", () => {
		expect(validateInternalShopsSearch({})).toEqual({
			cursor: undefined,
			dir: "desc",
			limit: 25,
			prev: undefined,
			q: undefined,
			sort: "createdAt",
			status: undefined,
		});
	});

	it("preserves valid shop filters and ignores invalid values", () => {
		expect(
			validateInternalShopsSearch({
				dir: "asc",
				limit: "50",
				q: "acme",
				sort: "domain",
				status: "connected",
			}),
		).toEqual({
			cursor: undefined,
			dir: "asc",
			limit: 50,
			prev: undefined,
			q: "acme",
			sort: "domain",
			status: "connected",
		});

		expect(
			validateInternalUsersSearch({
				dir: "sideways",
				limit: "999",
				role: "",
				sort: "weird",
			}),
		).toEqual({
			cursor: undefined,
			dir: "asc",
			limit: 25,
			prev: undefined,
			q: undefined,
			role: undefined,
			sort: "name",
		});
	});

	it("extends AI session detail search with transcript paging state", () => {
		expect(
			validateInternalAiSessionDetailSearch({
				q: "session_1",
				sort: "sessionId",
				transcriptCursor: "cursor_9",
				transcriptLimit: "10",
				transcriptPrev: "prev",
			}),
		).toEqual({
			cursor: undefined,
			dir: "desc",
			limit: 25,
			prev: undefined,
			q: "session_1",
			sort: "sessionId",
			transcriptCursor: "cursor_9",
			transcriptLimit: 10,
			transcriptPrev: "prev",
		});
	});
});
