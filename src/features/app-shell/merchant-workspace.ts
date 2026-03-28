import { convexAction, convexQuery } from "@convex-dev/react-query";
import type { Id } from "@convex/_generated/dataModel";
import { useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/convex-api";
import type { MerchantExplorerDatasetKey } from "@/shared/contracts/merchant-workspace";

export const merchantOverviewQuery = convexAction(api.merchantWorkspace.overview, {});
const DEFAULT_MERCHANT_EXPLORER_DATASET: MerchantExplorerDatasetKey = "products";

export function getMerchantCopilotStateQuery(conversationId?: Id<"merchantCopilotConversations">) {
	return convexQuery(api.merchantWorkspace.copilotState, conversationId ? { conversationId } : {});
}

export const merchantCopilotStateQuery = getMerchantCopilotStateQuery();
export const merchantCopilotSessionsQuery = convexQuery(api.merchantWorkspace.copilotSessions, {});
export function getMerchantExplorerQuery(dataset = DEFAULT_MERCHANT_EXPLORER_DATASET) {
	return convexAction(api.merchantWorkspace.explorer, { dataset });
}

export const merchantExplorerQuery = getMerchantExplorerQuery();
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

export function useMerchantExplorer(dataset = DEFAULT_MERCHANT_EXPLORER_DATASET) {
	const query = getMerchantExplorerQuery(dataset);

	return useSuspenseQuery({
		queryKey: query.queryKey,
		staleTime: query.staleTime,
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
			queryKey: merchantExplorerQuery.queryKey.slice(0, -1),
		}),
		queryClient.invalidateQueries({
			queryKey: merchantWorkflowsQuery.queryKey,
		}),
		queryClient.invalidateQueries({
			queryKey: merchantKnowledgeDocumentsQuery.queryKey,
		}),
	]);
}
