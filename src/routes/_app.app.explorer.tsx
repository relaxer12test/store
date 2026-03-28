import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantExplorerDetailPage } from "@/features/app-shell/components/merchant-explorer-detail-page";
import { MerchantExplorerPage } from "@/features/app-shell/components/merchant-explorer-page";
import {
	type MerchantExplorerSearch,
	getMerchantExplorerDocumentStatus,
	getMerchantExplorerDocumentVisibility,
	getMerchantExplorerProductStatus,
	normalizeMerchantExplorerSearchForDataset,
	serializeMerchantExplorerSearch,
	validateMerchantExplorerSearch,
} from "@/features/app-shell/merchant-explorer-route-state";
import {
	useMerchantExplorerDetail,
	useMerchantExplorerPage,
} from "@/features/app-shell/merchant-workspace";

export const Route = createFileRoute("/_app/app/explorer")({
	validateSearch: validateMerchantExplorerSearch,
	component: MerchantExplorerRoute,
});

function MerchantExplorerRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const search = Route.useSearch();
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
	const explorerQuery = useMerchantExplorerPage(search, cursor);
	const detailQuery = useMerchantExplorerDetail(search);

	useEffect(() => {
		setCursor(undefined);
		setCursorHistory([]);
	}, [search.dataset, search.q, search.status, search.visibility]);

	const listSearch = normalizeMerchantExplorerSearchForDataset({
		...search,
		rowId: undefined,
	});

	if (search.rowId) {
		return (
			<MerchantExplorerDetailPage
				backHref={`/app/explorer${serializeMerchantExplorerSearch(listSearch)}`}
				data={detailQuery.data}
				description={`Explorer ${search.dataset.replaceAll("_", " ")}`}
				errorMessage={
					detailQuery.data
						? null
						: detailQuery.error instanceof Error
							? detailQuery.error.message
							: null
				}
				isLoading={detailQuery.isPending && !detailQuery.data}
				title="Explorer detail"
			/>
		);
	}

	return (
		<MerchantExplorerPage
			activeDatasetKey={search.dataset}
			currentPage={cursorHistory.length + 1}
			data={explorerQuery.data}
			errorMessage={
				explorerQuery.data
					? null
					: explorerQuery.error instanceof Error
						? explorerQuery.error.message
						: null
			}
			isFetching={explorerQuery.isFetching}
			isLoading={explorerQuery.isPending && !explorerQuery.data}
			onDatasetChange={(dataset) => {
				void navigate({
					search: () =>
						normalizeMerchantExplorerSearchForDataset({
							dataset,
						}),
				});
			}}
			onFirstPage={
				cursorHistory.length > 0 || cursor
					? () => {
							setCursor(undefined);
							setCursorHistory([]);
						}
					: null
			}
			onGoToPage={(currentPage) => {
				setCursorHistory((current) => {
					if (currentPage <= 1) {
						setCursor(undefined);
						return [];
					}

					const nextCursor = current[currentPage - 1];
					setCursor(nextCursor);
					return current.slice(0, currentPage - 1);
				});
			}}
			onNextPage={
				explorerQuery.data?.pageInfo.continueCursor
					? () => {
							setCursorHistory((current) => [...current, cursor]);
							setCursor(explorerQuery.data?.pageInfo.continueCursor ?? undefined);
						}
					: null
			}
			onPreviousPage={
				cursorHistory.length > 0
					? () => {
							setCursorHistory((current) => {
								const previousCursor = current[current.length - 1];
								setCursor(previousCursor);
								return current.slice(0, -1);
							});
						}
					: null
			}
			getRowHref={(row) => {
				const rowId = row._row_id;

				if (!rowId || typeof rowId !== "string") {
					return null;
				}

				return `/app/explorer${serializeMerchantExplorerSearch({
					...search,
					rowId,
				})}`;
			}}
			onRetry={() => {
				void explorerQuery.refetch();
			}}
			onSearchChange={
				search.dataset === "audit_logs"
					? null
					: (value) => {
							void navigate({
								search: (current) =>
									normalizeMerchantExplorerSearchForDataset({
										...current,
										q: value || undefined,
										rowId: undefined,
									}),
							});
						}
			}
			onStatusChange={
				search.dataset === "products" || search.dataset === "documents"
					? (value) => {
							void navigate({
								search: (current) =>
									normalizeMerchantExplorerSearchForDataset({
										...current,
										rowId: undefined,
										status: value as MerchantExplorerSearch["status"],
									}),
							});
						}
					: null
			}
			onVisibilityChange={
				search.dataset === "documents"
					? (value) => {
							void navigate({
								search: (current) =>
									normalizeMerchantExplorerSearchForDataset({
										...current,
										rowId: undefined,
										visibility: value as MerchantExplorerSearch["visibility"],
									}),
							});
						}
					: null
			}
			searchValue={search.q ?? ""}
			statusValue={
				search.dataset === "products"
					? getMerchantExplorerProductStatus(search.status)
					: search.dataset === "documents"
						? getMerchantExplorerDocumentStatus(search.status)
						: undefined
			}
			visibilityValue={
				search.dataset === "documents"
					? getMerchantExplorerDocumentVisibility(search.visibility)
					: undefined
			}
		/>
	);
}
