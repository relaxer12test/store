import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MerchantExplorerPage } from "@/features/app-shell/components/merchant-explorer-page";
import {
	type MerchantExplorerSearch,
	getMerchantExplorerDocumentStatus,
	getMerchantExplorerDocumentVisibility,
	getMerchantExplorerProductStatus,
	normalizeMerchantExplorerSearchForDataset,
	validateMerchantExplorerSearch,
} from "@/features/app-shell/merchant-explorer-route-state";
import {
	invalidateMerchantWorkspaceQueries,
	useMerchantExplorerPage,
} from "@/features/app-shell/merchant-workspace";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/_app/app/explorer")({
	validateSearch: validateMerchantExplorerSearch,
	component: MerchantExplorerRoute,
});

function MerchantExplorerRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const queryClient = useQueryClient();
	const refreshProducts = useConvexMutation(api.merchantWorkspace.refreshExplorerProducts);
	const search = Route.useSearch();
	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
	const explorerQuery = useMerchantExplorerPage(search, cursor);
	const refreshProductsMutation = useMutation({
		mutationFn: refreshProducts,
		onSuccess: async () => {
			await invalidateMerchantWorkspaceQueries(queryClient);
		},
	});

	useEffect(() => {
		setCursor(undefined);
		setCursorHistory([]);
	}, [search.dataset, search.q, search.status, search.visibility]);

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
			isRefreshingProducts={refreshProductsMutation.isPending}
			onDatasetChange={(dataset) => {
				void navigate({
					search: () =>
						normalizeMerchantExplorerSearchForDataset({
							dataset,
						}),
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
			onRefreshProducts={
				search.dataset === "products"
					? () => {
							void refreshProductsMutation.mutateAsync({});
						}
					: null
			}
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
