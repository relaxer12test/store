import { convexAction, convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/convex-api";

export const merchantOverviewQuery = convexAction(api.merchantWorkspace.overview, {});
export const merchantCopilotStateQuery = convexQuery(api.merchantWorkspace.copilotState, {});
export const merchantExplorerQuery = convexAction(api.merchantWorkspace.explorer, {});
export const merchantWorkflowsQuery = convexQuery(api.merchantWorkspace.workflows, {});
export const merchantKnowledgeDocumentsQuery = convexQuery(
	api.merchantWorkspace.knowledgeDocuments,
	{},
);

export function useMerchantOverview() {
	return useSuspenseQuery({
		queryKey: merchantOverviewQuery.queryKey,
		staleTime: merchantOverviewQuery.staleTime,
	});
}

export function useMerchantCopilotState() {
	return useSuspenseQuery({
		queryKey: merchantCopilotStateQuery.queryKey,
		staleTime: merchantCopilotStateQuery.staleTime,
	});
}

export function useMerchantExplorer() {
	return useSuspenseQuery({
		queryKey: merchantExplorerQuery.queryKey,
		staleTime: merchantExplorerQuery.staleTime,
	});
}

export function useMerchantWorkflows() {
	return useSuspenseQuery({
		queryKey: merchantWorkflowsQuery.queryKey,
		staleTime: merchantWorkflowsQuery.staleTime,
	});
}

export function useMerchantKnowledgeDocuments() {
	return useSuspenseQuery({
		queryKey: merchantKnowledgeDocumentsQuery.queryKey,
		staleTime: merchantKnowledgeDocumentsQuery.staleTime,
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
			queryKey: merchantExplorerQuery.queryKey,
		}),
		queryClient.invalidateQueries({
			queryKey: merchantWorkflowsQuery.queryKey,
		}),
		queryClient.invalidateQueries({
			queryKey: merchantKnowledgeDocumentsQuery.queryKey,
		}),
	]);
}
