export const INTERNAL_DEFAULT_PAGE_SIZE = 25;
export const INTERNAL_PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

const ROOT_CURSOR_SENTINEL = "__root__";

export type InternalSortDirection = "asc" | "desc";

export interface InternalListSearchState<TSort extends string> {
	cursor?: string;
	dir: InternalSortDirection;
	limit: number;
	prev?: string;
	q?: string;
	sort: TSort;
}

function readString(value: unknown) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

export function normalizeInternalSearchText(value: unknown) {
	return readString(value);
}

export function normalizeInternalPageSize(value: unknown) {
	const parsed = Number(value);

	return INTERNAL_PAGE_SIZE_OPTIONS.includes(parsed as (typeof INTERNAL_PAGE_SIZE_OPTIONS)[number])
		? parsed
		: INTERNAL_DEFAULT_PAGE_SIZE;
}

export function normalizeInternalDirection(
	value: unknown,
	fallback: InternalSortDirection = "desc",
): InternalSortDirection {
	return value === "asc" || value === "desc" ? value : fallback;
}

export function encodeInternalCursorHistory(history: Array<string | undefined>) {
	if (history.length === 0) {
		return undefined;
	}

	return encodeURIComponent(
		JSON.stringify(history.map((cursor) => cursor ?? ROOT_CURSOR_SENTINEL)),
	);
}

export function decodeInternalCursorHistory(value: unknown) {
	const encoded = readString(value);

	if (!encoded) {
		return [] as Array<string | undefined>;
	}

	try {
		const parsed = JSON.parse(decodeURIComponent(encoded));

		return Array.isArray(parsed)
			? parsed.map((entry) =>
					typeof entry === "string" ? (entry === ROOT_CURSOR_SENTINEL ? undefined : entry) : undefined,
				)
			: [];
	} catch {
		return [] as Array<string | undefined>;
	}
}

export function buildNextInternalCursorState<TSort extends string>(
	search: InternalListSearchState<TSort>,
	nextCursor: string | null,
): InternalListSearchState<TSort> {
	const history = decodeInternalCursorHistory(search.prev);

	return {
		...search,
		cursor: nextCursor ?? undefined,
		prev: encodeInternalCursorHistory([...history, search.cursor]),
	};
}

export function buildPreviousInternalCursorState<TSort extends string>(
	search: InternalListSearchState<TSort>,
): InternalListSearchState<TSort> {
	const history = decodeInternalCursorHistory(search.prev);
	const previousCursor = history[history.length - 1];

	return {
		...search,
		cursor: previousCursor,
		prev: encodeInternalCursorHistory(history.slice(0, -1)),
	};
}

export function serializeInternalSearch(
	search: Record<string, number | string | undefined>,
) {
	const params = new URLSearchParams();

	for (const [key, value] of Object.entries(search)) {
		if (value === undefined) {
			continue;
		}

		params.set(key, String(value));
	}

	const encoded = params.toString();

	return encoded.length > 0 ? `?${encoded}` : "";
}
