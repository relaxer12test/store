import { useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { CopilotChatLayout } from "@/features/app-shell/components/copilot/copilot-chat-layout";
import { CopilotComposer } from "@/features/app-shell/components/copilot/copilot-composer";
import { CopilotEmptyState } from "@/features/app-shell/components/copilot/copilot-empty-state";
import {
	CopilotThread,
	ScrollToBottomButton,
	useCopilotScroll,
} from "@/features/app-shell/components/copilot/copilot-thread";
import {
	invalidateMerchantWorkspaceQueries,
	merchantCopilotStateQuery,
} from "@/features/app-shell/merchant-workspace";
import { api } from "@/lib/convex-api";
import type { MerchantCopilotConversation } from "@/shared/contracts/merchant-workspace";

async function refreshConversationState(queryClient: ReturnType<typeof useQueryClient>) {
	await queryClient.invalidateQueries({
		queryKey: merchantCopilotStateQuery.queryKey,
	});

	return await queryClient.fetchQuery(merchantCopilotStateQuery);
}

export function MerchantCopilotPage({
	conversation,
}: {
	conversation: MerchantCopilotConversation;
}) {
	const queryClient = useQueryClient();
	const threadRef = useRef<HTMLDivElement>(null);
	const { scrollAnchorRef, isAtBottom, scrollToBottom } = useCopilotScroll(
		threadRef,
		conversation.messages.length,
	);

	const requestCopilot = useConvexAction(api.merchantWorkspace.askCopilot);
	const approveAction = useConvexAction(api.merchantWorkspace.approveAction);
	const rejectAction = useConvexMutation(api.merchantWorkspace.rejectAction);

	const askMutation = useMutation({
		mutationFn: requestCopilot,
		onSuccess: async (nextConversation) => {
			queryClient.setQueryData(merchantCopilotStateQuery.queryKey, nextConversation);
			await invalidateMerchantWorkspaceQueries(queryClient);
		},
	});

	const approveMutation = useMutation({
		mutationFn: approveAction,
		onSuccess: async () => {
			await invalidateMerchantWorkspaceQueries(queryClient);
			queryClient.setQueryData(
				merchantCopilotStateQuery.queryKey,
				await refreshConversationState(queryClient),
			);
		},
	});

	const rejectMutation = useMutation({
		mutationFn: rejectAction,
		onSuccess: async () => {
			await invalidateMerchantWorkspaceQueries(queryClient);
			queryClient.setQueryData(
				merchantCopilotStateQuery.queryKey,
				await refreshConversationState(queryClient),
			);
		},
	});

	const activeApprovalId = approveMutation.isPending
		? (approveMutation.variables?.approvalId ?? null)
		: rejectMutation.isPending
			? (rejectMutation.variables?.approvalId ?? null)
			: null;

	const isWorking = askMutation.isPending || approveMutation.isPending || rejectMutation.isPending;

	function submitPrompt(prompt: string) {
		const trimmed = prompt.trim();
		if (trimmed.length < 4) return;

		askMutation.mutate({
			conversationId:
				(conversation.conversationId as Id<"merchantCopilotConversations"> | null) ?? undefined,
			prompt: trimmed,
		});
	}

	return (
		<div className="relative">
			<CopilotChatLayout
				composer={
					<CopilotComposer
						error={askMutation.error ?? null}
						isWorking={isWorking}
						onSubmit={submitPrompt}
						quickPrompts={conversation.quickPrompts}
						showChips={conversation.messages.length === 0}
					/>
				}
				threadRef={threadRef}
			>
				{conversation.messages.length === 0 ? (
					<CopilotEmptyState
						onSubmit={submitPrompt}
						quickPrompts={conversation.quickPrompts}
					/>
				) : (
					<CopilotThread
						activeApprovalId={activeApprovalId}
						isWorking={isWorking}
						messages={conversation.messages}
						onApprove={(approvalId) =>
							approveMutation.mutate({
								approvalId: approvalId as Id<"merchantActionApprovals">,
							})
						}
						onReject={(approvalId) =>
							rejectMutation.mutate({
								approvalId: approvalId as Id<"merchantActionApprovals">,
							})
						}
						scrollAnchorRef={scrollAnchorRef}
					/>
				)}
			</CopilotChatLayout>

			{!isAtBottom && conversation.messages.length > 0 ? (
				<ScrollToBottomButton onClick={scrollToBottom} />
			) : null}
		</div>
	);
}
