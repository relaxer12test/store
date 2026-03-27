import {
	buildNextInternalCursorState,
	buildPreviousInternalCursorState,
	type InternalListSearchState,
	type InternalSortDirection,
	serializeInternalSearch,
} from "@/features/internal/internal-admin-search";

export function buildInternalHref(
	pathname: string,
	search: Record<string, number | string | undefined>,
) {
	return `${pathname}${serializeInternalSearch(search)}`;
}

export function formatInternalSortValue(sort: string, direction: InternalSortDirection) {
	return `${sort}:${direction}`;
}

export function parseInternalSortValue<TSort extends string>(
	value: string,
	fallback: {
		direction: InternalSortDirection;
		sort: TSort;
	},
) {
	const [sort, direction] = value.split(":");

	return {
		direction: direction === "asc" || direction === "desc" ? direction : fallback.direction,
		sort: sort ? (sort as TSort) : fallback.sort,
	};
}

export function resetInternalPagination<TSearch extends { cursor?: string; prev?: string }>(
	search: TSearch,
	patch: Partial<TSearch>,
): TSearch {
	return {
		...search,
		...patch,
		cursor: undefined,
		prev: undefined,
	};
}

export function advanceInternalPage<TSort extends string>(
	search: InternalListSearchState<TSort>,
	nextCursor: string | null,
) {
	return buildNextInternalCursorState(search, nextCursor);
}

export function rewindInternalPage<TSort extends string>(search: InternalListSearchState<TSort>) {
	return buildPreviousInternalCursorState(search);
}
