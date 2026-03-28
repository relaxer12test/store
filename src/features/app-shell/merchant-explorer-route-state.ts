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
				status: getMerchantExplorerProductStatus(search.status),
			};
		case "documents":
			return {
				dataset: search.dataset,
				q: search.q,
				status: getMerchantExplorerDocumentStatus(search.status),
				visibility: getMerchantExplorerDocumentVisibility(search.visibility),
			};
		case "inventory":
		case "orders":
			return {
				dataset: search.dataset,
				q: search.q,
			};
		case "audit_logs":
			return {
				dataset: search.dataset,
			};
	}
}
