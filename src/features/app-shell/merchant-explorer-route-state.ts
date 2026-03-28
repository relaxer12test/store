import type { MerchantExplorerDatasetKey } from "@/shared/contracts/merchant-workspace";

function normalizeEnum<TValue extends string>(
	value: unknown,
	options: readonly TValue[],
	fallback?: TValue,
) {
	if (options.includes(value as TValue)) {
		return value as TValue;
	}

	return fallback;
}

function normalizeSearchText(value: unknown) {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

const productStatusValues = ["active", "all", "archived", "draft"] as const;
const documentStatusValues = ["all", "failed", "processing", "ready"] as const;
const documentVisibilityValues = ["all", "public", "shop_private"] as const;

export type MerchantExplorerProductStatus = (typeof productStatusValues)[number];
export type MerchantExplorerDocumentStatus = (typeof documentStatusValues)[number];
export type MerchantExplorerDocumentVisibility = (typeof documentVisibilityValues)[number];

export interface MerchantExplorerSearch {
	dataset: MerchantExplorerDatasetKey;
	q?: string;
	rowId?: string;
	status?: MerchantExplorerDocumentStatus | MerchantExplorerProductStatus;
	visibility?: MerchantExplorerDocumentVisibility;
}

export function validateMerchantExplorerSearch(
	search: Record<string, unknown>,
): MerchantExplorerSearch {
	return normalizeMerchantExplorerSearchForDataset({
		dataset:
			normalizeEnum(
				search.dataset,
				["products", "orders", "inventory", "documents", "audit_logs"] as const,
				"products",
			) ?? "products",
		q: normalizeSearchText(search.q),
		rowId: normalizeSearchText(search.rowId),
		status: normalizeEnum(search.status, [
			...productStatusValues,
			...documentStatusValues,
		] as const),
		visibility: normalizeEnum(search.visibility, documentVisibilityValues),
	});
}

export function getMerchantExplorerProductStatus(
	status: MerchantExplorerSearch["status"],
): MerchantExplorerProductStatus {
	return normalizeEnum(status, productStatusValues, "all") ?? "all";
}

export function getMerchantExplorerDocumentStatus(
	status: MerchantExplorerSearch["status"],
): MerchantExplorerDocumentStatus {
	return normalizeEnum(status, documentStatusValues, "all") ?? "all";
}

export function getMerchantExplorerDocumentVisibility(
	visibility: MerchantExplorerSearch["visibility"],
): MerchantExplorerDocumentVisibility {
	return normalizeEnum(visibility, documentVisibilityValues, "all") ?? "all";
}

export function normalizeMerchantExplorerSearchForDataset(
	search: MerchantExplorerSearch,
): MerchantExplorerSearch {
	switch (search.dataset) {
		case "products":
			return {
				dataset: search.dataset,
				q: search.q,
				rowId: search.rowId,
				status: getMerchantExplorerProductStatus(search.status),
			};
		case "documents":
			return {
				dataset: search.dataset,
				q: search.q,
				rowId: search.rowId,
				status: getMerchantExplorerDocumentStatus(search.status),
				visibility: getMerchantExplorerDocumentVisibility(search.visibility),
			};
		case "inventory":
		case "orders":
			return {
				dataset: search.dataset,
				q: search.q,
				rowId: search.rowId,
			};
		case "audit_logs":
			return {
				dataset: search.dataset,
				rowId: search.rowId,
			};
	}
}

export function serializeMerchantExplorerSearch(search: MerchantExplorerSearch) {
	const params = new URLSearchParams();

	params.set("dataset", search.dataset);

	if (search.q) {
		params.set("q", search.q);
	}

	if (search.rowId) {
		params.set("rowId", search.rowId);
	}

	if (search.status && search.status !== "all") {
		params.set("status", search.status);
	}

	if (search.visibility && search.visibility !== "all") {
		params.set("visibility", search.visibility);
	}

	const encoded = params.toString();
	return encoded.length > 0 ? `?${encoded}` : "";
}
