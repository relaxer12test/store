import { describe, expect, it } from "vitest";
import {
	buildNextInternalCursorState,
	buildPreviousInternalCursorState,
	decodeInternalCursorHistory,
	encodeInternalCursorHistory,
	serializeInternalSearch,
} from "@/features/internal/internal-admin-search";

describe("internal-admin-search", () => {
	it("encodes and decodes cursor history with the root page sentinel", () => {
		const encoded = encodeInternalCursorHistory([undefined, "cursor_2", "cursor_3"]);

		expect(decodeInternalCursorHistory(encoded)).toEqual([undefined, "cursor_2", "cursor_3"]);
	});

	it("tracks next and previous cursor navigation", () => {
		const initial = {
			cursor: undefined,
			dir: "desc" as const,
			limit: 25,
			prev: undefined,
			sort: "updatedAt" as const,
		};
		const secondPage = buildNextInternalCursorState(initial, "cursor_2");
		const thirdPage = buildNextInternalCursorState(secondPage, "cursor_3");

		expect(thirdPage.cursor).toBe("cursor_3");
		expect(decodeInternalCursorHistory(thirdPage.prev)).toEqual([undefined, "cursor_2"]);

		const rewound = buildPreviousInternalCursorState(thirdPage);

		expect(rewound.cursor).toBe("cursor_2");
		expect(decodeInternalCursorHistory(rewound.prev)).toEqual([undefined]);
	});

	it("serializes only defined search params", () => {
		expect(
			serializeInternalSearch({
				cursor: undefined,
				limit: 25,
				q: "shop",
				sort: "createdAt",
			}),
		).toBe("?limit=25&q=shop&sort=createdAt");
	});
});
