import { useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CopilotChatLayout } from "@/features/app-shell/components/copilot/copilot-chat-layout";
import { CopilotComposer } from "@/features/app-shell/components/copilot/copilot-composer";
import { CopilotEmptyState } from "@/features/app-shell/components/copilot/copilot-empty-state";
import { CopilotSessionRail } from "@/features/app-shell/components/copilot/copilot-session-rail";
import {
	CopilotThread,
	ScrollToBottomButton,
	useCopilotScroll,
} from "@/features/app-shell/components/copilot/copilot-thread";
import {
	getMerchantCopilotStateQuery,
	invalidateMerchantWorkspaceQueries,
	merchantCopilotSessionsQuery,
} from "@/features/app-shell/merchant-workspace";
import { api } from "@/lib/convex-api";
import type {
	MerchantCopilotConversation,
	MerchantCopilotSessionSummary,
} from "@/shared/contracts/merchant-workspace";

async function refreshConversationState(
	queryClient: ReturnType<typeof useQueryClient>,
	conversationId?: Id<"merchantCopilotConversations">,
) {
	const query = getMerchantCopilotStateQuery(conversationId);
	await queryClient.invalidateQueries({
		queryKey: query.queryKey,
	});

	return await queryClient.fetchQuery(query);
}

export function MerchantCopilotPage({
	activeConversationId,
	conversation,
	sessions,
}: {
	activeConversationId: string | null;
	conversation: MerchantCopilotConversation;
	sessions: MerchantCopilotSessionSummary[];
}) {
	const navigate = useNavigate({
		from: "/app/copilot",
	});
	const queryClient = useQueryClient();
	const threadRef = useRef<HTMLDivElement>(null);
	const [editTitle, setEditTitle] = useState("");
	const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
	const { scrollAnchorRef, isAtBottom, scrollToBottom } = useCopilotScroll(
		threadRef,
		conversation.messages.length,
	);

	const requestCopilot = useConvexAction(api.merchantWorkspace.askCopilot);
	const createConversation = useConvexMutation(api.merchantWorkspace.createConversation);
	const renameConversation = useConvexMutation(api.merchantWorkspace.renameConversation);
	const deleteConversation = useConvexMutation(api.merchantWorkspace.deleteConversation);
	const approveAction = useConvexAction(api.merchantWorkspace.approveAction);
	const rejectAction = useConvexMutation(api.merchantWorkspace.rejectAction);
	const resolvedConversationId =
		((activeConversationId ?? conversation.conversationId) as
			| Id<"merchantCopilotConversations">
			| null
			| undefined) ?? null;

	const askMutation = useMutation({
		mutationFn: requestCopilot,
		onSuccess: async (nextConversation) => {
			queryClient.setQueryData(
				getMerchantCopilotStateQuery(resolvedConversationId ?? undefined).queryKey,
				nextConversation,
			);
			await invalidateMerchantWorkspaceQueries(queryClient);
		},
	});

	const createConversationMutation = useMutation({
		mutationFn: createConversation,
		onSuccess: async (result) => {
			setEditingConversationId(null);
			await invalidateMerchantWorkspaceQueries(queryClient);
			void navigate({
				search: (current) => ({
					...current,
					conversation: result.conversationId,
				}),
			});
		},
	});

	const renameConversationMutation = useMutation({
		mutationFn: renameConversation,
		onSuccess: async () => {
			setEditingConversationId(null);
			setEditTitle("");
			await queryClient.invalidateQueries({
				queryKey: merchantCopilotSessionsQuery.queryKey,
			});
		},
	});

	const deleteConversationMutation = useMutation({
		mutationFn: deleteConversation,
		onSuccess: async (_, variables) => {
			setEditingConversationId((current) =>
				current === variables.conversationId ? null : current,
			);
			setEditTitle("");
			await invalidateMerchantWorkspaceQueries(queryClient);
			const sessionData = await queryClient.fetchQuery(merchantCopilotSessionsQuery);
			const nextConversationId =
				sessionData.sessions.find((session) => session.conversationId !== variables.conversationId)
					?.conversationId ?? undefined;
			void navigate({
				search: (current) => ({
					...current,
					conversation: nextConversationId,
				}),
				replace: true,
			});
		},
	});

	const approveMutation = useMutation({
		mutationFn: approveAction,
		onSuccess: async () => {
			await invalidateMerchantWorkspaceQueries(queryClient);
			queryClient.setQueryData(
				getMerchantCopilotStateQuery(resolvedConversationId ?? undefined).queryKey,
				await refreshConversationState(queryClient, resolvedConversationId ?? undefined),
			);
		},
	});

	const rejectMutation = useMutation({
		mutationFn: rejectAction,
		onSuccess: async () => {
			await invalidateMerchantWorkspaceQueries(queryClient);
			queryClient.setQueryData(
				getMerchantCopilotStateQuery(resolvedConversationId ?? undefined).queryKey,
				await refreshConversationState(queryClient, resolvedConversationId ?? undefined),
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
			conversationId: resolvedConversationId ?? undefined,
			prompt: trimmed,
		});
	}

	function startRenameSession(session: MerchantCopilotSessionSummary) {
		setEditingConversationId(session.conversationId);
		setEditTitle(session.title);
	}

	function commitRename(conversationId: string) {
		const title = editTitle.trim();
		if (title.length < 3 || renameConversationMutation.isPending) {
			return;
		}

		renameConversationMutation.mutate({
			conversationId: conversationId as Id<"merchantCopilotConversations">,
			title,
		});
	}

	function deleteSession(conversationId: string) {
		if (deleteConversationMutation.isPending) {
			return;
		}

		const confirmed = window.confirm(
			"Delete this copilot conversation? Pending approvals must be resolved first.",
		);

		if (!confirmed) {
			return;
		}

		deleteConversationMutation.mutate({
			conversationId: conversationId as Id<"merchantCopilotConversations">,
		});
	}

	const activeSession =
		sessions.find((session) => session.conversationId === (resolvedConversationId ?? null)) ?? null;

	return (
		<div className="grid gap-4 xl:grid-cols-[20rem_minmax(0,1fr)]">
			<CopilotSessionRail
				activeConversationId={(resolvedConversationId as string | null) ?? null}
				deleteError={deleteConversationMutation.error ?? null}
				deletePendingConversationId={
					deleteConversationMutation.isPending
						? (deleteConversationMutation.variables?.conversationId ?? null)
						: null
				}
				editTitle={editTitle}
				editingConversationId={editingConversationId}
				isCreating={createConversationMutation.isPending}
				isRenaming={renameConversationMutation.isPending}
				onCreateConversation={() => createConversationMutation.mutate({})}
				onDeleteConversation={deleteSession}
				onRenameCancel={() => {
					setEditingConversationId(null);
					setEditTitle("");
				}}
				onRenameChange={setEditTitle}
				onRenameConversation={commitRename}
				onRenameStart={startRenameSession}
				onSelectConversation={(conversationId) => {
					setEditingConversationId(null);
					setEditTitle("");
					void navigate({
						search: (current) => ({
							...current,
							conversation: conversationId,
						}),
					});
				}}
				renameError={renameConversationMutation.error ?? null}
				sessions={sessions}
			/>

			<div className="relative rounded-lg border border-zinc-950/5 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900">
				<div className="mb-4 flex items-center justify-between gap-3 border-b border-zinc-950/5 pb-4 dark:border-white/10">
					<div>
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">
							Copilot
						</p>
						<p className="text-lg font-semibold text-zinc-950 dark:text-white">
							{activeSession?.title ?? "Current conversation"}
						</p>
					</div>
					{activeSession?.pendingApprovalCount ? (
						<p className="text-xs font-medium text-amber-700 dark:text-amber-300">
							{activeSession.pendingApprovalCount} approval(s) waiting
						</p>
					) : null}
				</div>

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
						<CopilotEmptyState onSubmit={submitPrompt} quickPrompts={conversation.quickPrompts} />
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
		</div>
	);
}
