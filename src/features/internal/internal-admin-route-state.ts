import {
	type InternalListSearchState,
	type InternalSortDirection,
	normalizeInternalDirection,
	normalizeInternalPageSize,
	normalizeInternalSearchText,
} from "@/features/internal/internal-admin-search";

function normalizeEnum<TValue extends string>(
	value: unknown,
	options: readonly TValue[],
	fallback: TValue,
) {
	return options.includes(value as TValue) ? (value as TValue) : fallback;
}

function normalizeOptionalEnum<TValue extends string>(
	value: unknown,
	options: readonly TValue[],
) {
	return options.includes(value as TValue) ? (value as TValue) : undefined;
}

function normalizeOptionalString(value: unknown) {
	return normalizeInternalSearchText(value);
}

function createSearchState<TSort extends string>(
	search: Record<string, unknown>,
	options: {
		defaultDirection: InternalSortDirection;
		defaultSort: TSort;
		sorts: readonly TSort[];
	},
): InternalListSearchState<TSort> {
	return {
		cursor: normalizeOptionalString(search.cursor),
		dir: normalizeInternalDirection(search.dir, options.defaultDirection),
		limit: normalizeInternalPageSize(search.limit),
		prev: normalizeOptionalString(search.prev),
		q: normalizeOptionalString(search.q),
		sort: normalizeEnum(search.sort, options.sorts, options.defaultSort),
	};
}

export type InternalShopsSort = "createdAt" | "domain";
export interface InternalShopsSearch extends InternalListSearchState<InternalShopsSort> {
	status?: "connected" | "inactive" | "pending";
}

export function validateInternalShopsSearch(search: Record<string, unknown>): InternalShopsSearch {
	return {
		...createSearchState(search, {
			defaultDirection: "desc",
			defaultSort: "createdAt",
			sorts: ["createdAt", "domain"],
		}),
		status: normalizeOptionalEnum(search.status, ["connected", "inactive", "pending"]),
	};
}

export type InternalCacheSort = "cacheKey" | "updatedAt";
export interface InternalCacheSearch extends InternalListSearchState<InternalCacheSort> {
	status?: string;
}

export function validateInternalCacheSearch(search: Record<string, unknown>): InternalCacheSearch {
	return {
		...createSearchState(search, {
			defaultDirection: "desc",
			defaultSort: "updatedAt",
			sorts: ["updatedAt", "cacheKey"],
		}),
		status: normalizeOptionalString(search.status),
	};
}

export type InternalWorkflowSort = "lastUpdatedAt" | "type";
export interface InternalWorkflowSearch extends InternalListSearchState<InternalWorkflowSort> {
	status?: string;
}

export function validateInternalWorkflowSearch(
	search: Record<string, unknown>,
): InternalWorkflowSearch {
	return {
		...createSearchState(search, {
			defaultDirection: "desc",
			defaultSort: "lastUpdatedAt",
			sorts: ["lastUpdatedAt", "type"],
		}),
		status: normalizeOptionalString(search.status),
	};
}

export type InternalWebhookSort = "receivedAt" | "topic";
export interface InternalWebhookSearch extends InternalListSearchState<InternalWebhookSort> {
	status?: string;
}

export function validateInternalWebhookSearch(search: Record<string, unknown>): InternalWebhookSearch {
	return {
		...createSearchState(search, {
			defaultDirection: "desc",
			defaultSort: "receivedAt",
			sorts: ["receivedAt", "topic"],
		}),
		status: normalizeOptionalString(search.status),
	};
}

export type InternalAuditSort = "action" | "createdAt";
export type InternalAuditSearch = InternalListSearchState<InternalAuditSort>;

export function validateInternalAuditSearch(search: Record<string, unknown>): InternalAuditSearch {
	return createSearchState(search, {
		defaultDirection: "desc",
		defaultSort: "createdAt",
		sorts: ["createdAt", "action"],
	});
}

export type InternalAiSessionSort = "sessionId" | "updatedAt";
export type InternalAiSessionSearch = InternalListSearchState<InternalAiSessionSort>;

export function validateInternalAiSessionSearch(
	search: Record<string, unknown>,
): InternalAiSessionSearch {
	return createSearchState(search, {
		defaultDirection: "desc",
		defaultSort: "updatedAt",
		sorts: ["updatedAt", "sessionId"],
	});
}

export interface InternalAiSessionDetailSearch extends InternalAiSessionSearch {
	transcriptCursor?: string;
	transcriptLimit: number;
	transcriptPrev?: string;
}

export function validateInternalAiSessionDetailSearch(
	search: Record<string, unknown>,
): InternalAiSessionDetailSearch {
	return {
		...validateInternalAiSessionSearch(search),
		transcriptCursor: normalizeOptionalString(search.transcriptCursor),
		transcriptLimit: normalizeInternalPageSize(search.transcriptLimit),
		transcriptPrev: normalizeOptionalString(search.transcriptPrev),
	};
}

export type InternalUsersSort = "createdAt" | "name";
export interface InternalUsersSearch extends InternalListSearchState<InternalUsersSort> {
	role?: string;
}

export function validateInternalUsersSearch(search: Record<string, unknown>): InternalUsersSearch {
	return {
		...createSearchState(search, {
			defaultDirection: "asc",
			defaultSort: "name",
			sorts: ["name", "createdAt"],
		}),
		role: normalizeOptionalString(search.role),
	};
}
