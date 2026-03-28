import { convexAction, convexQuery } from "@convex-dev/react-query";
import type { Id } from "@convex/_generated/dataModel";
import {
	keepPreviousData,
	useQuery,
	useSuspenseQuery,
	type QueryClient,
	type UseQueryOptions,
} from "@tanstack/react-query";
import {
	type MerchantExplorerSearch,
	getMerchantExplorerDocumentStatus,
	getMerchantExplorerDocumentVisibility,
	getMerchantExplorerProductStatus,
} from "@/features/app-shell/merchant-explorer-route-state";
import { api } from "@/lib/convex-api";
import type {
	MerchantExplorerDatasetKey,
	MerchantExplorerPageData,
} from "@/shared/contracts/merchant-workspace";

export const merchantOverviewQuery = convexAction(api.merchantWorkspace.overview, {});
export const DEFAULT_MERCHANT_EXPLORER_DATASET: MerchantExplorerDatasetKey = "products";
export const MERCHANT_EXPLORER_PAGE_SIZE = 50;

export function getMerchantCopilotStateQuery(conversationId?: Id<"merchantCopilotConversations">) {
	return convexQuery(api.merchantWorkspace.copilotState, conversationId ? { conversationId } : {});
}

export const merchantCopilotStateQuery = getMerchantCopilotStateQuery();
export const merchantCopilotSessionsQuery = convexQuery(api.merchantWorkspace.copilotSessions, {});

function toPaginationArgs(cursor?: string) {
	return {
		paginationOpts: {
			cursor: cursor ?? null,
			numItems: MERCHANT_EXPLORER_PAGE_SIZE,
		},
	};
}

export function getMerchantExplorerPageQuery(search: MerchantExplorerSearch, cursor?: string) {
	switch (search.dataset) {
		case "products":
			return convexAction(api.merchantWorkspace.explorerProductsPage, {
				...toPaginationArgs(cursor),
				q: search.q,
				status: getMerchantExplorerProductStatus(search.status),
			});
		case "inventory":
			return convexAction(api.merchantWorkspace.explorerInventoryPage, {
				cursor,
				q: search.q,
			});
		case "orders":
			return convexAction(api.merchantWorkspace.explorerOrdersPage, {
				cursor,
				q: search.q,
			});
		case "documents":
			return convexQuery(api.merchantWorkspace.explorerDocumentsPage, {
				...toPaginationArgs(cursor),
				q: search.q,
				status: getMerchantExplorerDocumentStatus(search.status),
				visibility: getMerchantExplorerDocumentVisibility(search.visibility),
			});
		case "audit_logs":
			return convexQuery(api.merchantWorkspace.explorerAuditLogsPage, {
				...toPaginationArgs(cursor),
			});
	}
}

export const merchantExplorerProductsQuery = getMerchantExplorerPageQuery({
	dataset: "products",
	status: "all",
});
export const merchantExplorerInventoryQuery = getMerchantExplorerPageQuery({
	dataset: "inventory",
});
export const merchantExplorerOrdersQuery = getMerchantExplorerPageQuery({
	dataset: "orders",
});
export const merchantExplorerDocumentsQuery = getMerchantExplorerPageQuery({
	dataset: "documents",
	status: "all",
	visibility: "all",
});
export const merchantExplorerAuditLogsQuery = getMerchantExplorerPageQuery({
	dataset: "audit_logs",
});
export const merchantWorkflowsQuery = convexQuery(api.merchantWorkspace.workflows, {});
export const merchantKnowledgeDocumentsQuery = convexQuery(
	api.merchantDocuments.knowledgeDocuments,
	{},
);

export function useMerchantOverview() {
	return useSuspenseQuery({
		queryKey: merchantOverviewQuery.queryKey,
		staleTime: merchantOverviewQuery.staleTime,
	});
}

export function useMerchantCopilotState(conversationId?: Id<"merchantCopilotConversations">) {
	return useSuspenseQuery(getMerchantCopilotStateQuery(conversationId));
}

export function useMerchantCopilotSessions() {
	return useSuspenseQuery(merchantCopilotSessionsQuery);
}

export function useMerchantExplorerPage(search: MerchantExplorerSearch, cursor?: string) {
	const query = getMerchantExplorerPageQuery(
		search,
		cursor,
	) as UseQueryOptions<MerchantExplorerPageData>;

	return useQuery({
		...query,
		placeholderData: keepPreviousData,
		refetchInterval: (queryState) =>
			queryState.state.data?.syncState &&
			(queryState.state.data.syncState.status === "pending" ||
				queryState.state.data.syncState.status === "running")
				? 3_000
				: false,
	});
}

export function useMerchantWorkflows() {
	return useSuspenseQuery(merchantWorkflowsQuery);
}

export function useMerchantKnowledgeDocuments() {
	return useSuspenseQuery({
		...merchantKnowledgeDocumentsQuery,
		refetchInterval: (query) =>
			query.state.data?.documents.some((document) => document.status === "processing")
				? 3_000
				: false,
	});
}

export async function invalidateMerchantWorkspaceQueries(queryClient: QueryClient) {
	await Promise.all([
		queryClient.invalidateQueries({
			queryKey: merchantOverviewQuery.queryKey,
		}),
		queryClient.invalidateQueries({
			queryKey: merchantCopilotStateQuery.queryKey,
		}),
		queryClient.invalidateQueries({
			queryKey: merchantCopilotStateQuery.queryKey.slice(0, -1),
		}),
		queryClient.invalidateQueries({
			queryKey: merchantCopilotSessionsQuery.queryKey,
		}),
		queryClient.invalidateQueries({
			queryKey: merchantExplorerProductsQuery.queryKey.slice(0, -1),
		}),
		queryClient.invalidateQueries({
			queryKey: merchantExplorerInventoryQuery.queryKey.slice(0, -1),
		}),
		queryClient.invalidateQueries({
			queryKey: merchantExplorerOrdersQuery.queryKey.slice(0, -1),
		}),
		queryClient.invalidateQueries({
			queryKey: merchantExplorerDocumentsQuery.queryKey.slice(0, -1),
		}),
		queryClient.invalidateQueries({
			queryKey: merchantExplorerAuditLogsQuery.queryKey.slice(0, -1),
		}),
		queryClient.invalidateQueries({
			queryKey: merchantWorkflowsQuery.queryKey,
		}),
		queryClient.invalidateQueries({
			queryKey: merchantKnowledgeDocumentsQuery.queryKey,
		}),
	]);
}
