import { useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import type { Id } from "@convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/cata/button";
import { Text } from "@/components/ui/cata/text";
import { Textarea } from "@/components/ui/cata/textarea";
import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import {
	MerchantApprovalCards,
	MerchantCitationList,
	MerchantDashboard,
} from "@/features/app-shell/components/merchant-workspace-ui";
import {
	invalidateMerchantWorkspaceQueries,
	merchantCopilotStateQuery,
} from "@/features/app-shell/merchant-workspace";
import { api } from "@/lib/convex-api";
import type { MerchantCopilotConversation } from "@/shared/contracts/merchant-workspace";

function formatTimestamp(value: string) {
	const parsed = Date.parse(value);

	return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
}

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
	const requestCopilot = useConvexAction(api.merchantWorkspace.askCopilot);
	const approveAction = useConvexAction(api.merchantWorkspace.approveAction);
	const rejectAction = useConvexMutation(api.merchantWorkspace.rejectAction);
	const form = useForm({
		defaultValues: {
			prompt: "",
		},
		onSubmit: async ({ value }) => {
			const normalizedPrompt = value.prompt.trim();

			if (normalizedPrompt.length < 4) {
				return;
			}

			await askMutation.mutateAsync({
				conversationId:
					(conversation.conversationId as Id<"merchantCopilotConversations"> | null) ?? undefined,
				prompt: normalizedPrompt,
			});
			form.reset();
		},
	});
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
	function submitPrompt(nextPrompt: string) {
		const normalizedPrompt = nextPrompt.trim();

		if (normalizedPrompt.length < 4) {
			return;
		}

		askMutation.mutate({
			conversationId:
				(conversation.conversationId as Id<"merchantCopilotConversations"> | null) ?? undefined,
			prompt: normalizedPrompt,
		});
	}

	const isWorking = askMutation.isPending || approveMutation.isPending || rejectMutation.isPending;
	const activityLabel = askMutation.isPending
		? "grounding answer"
		: approveMutation.isPending
			? "executing approval"
			: rejectMutation.isPending
				? "rejecting approval"
				: "idle";

	return (
		<div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4">
			<div className="-mx-1 overflow-x-auto pb-1">
				<div className="flex min-w-max gap-3 px-1">
					{conversation.quickPrompts.map((quickPrompt) => (
						<Button
							outline
							disabled={isWorking}
							key={quickPrompt}
							onClick={() => submitPrompt(quickPrompt)}
							type="button"
						>
							{quickPrompt}
						</Button>
					))}
				</div>
			</div>

			<Panel className="flex min-h-0 flex-1 flex-col" title="Copilot">
				<div className="flex flex-wrap items-center gap-3 border-b border-zinc-950/5 pb-4 dark:border-white/10">
					<StatusPill tone={isWorking ? "watch" : "neutral"}>{activityLabel}</StatusPill>
					{conversation.conversationId ? (
						<StatusPill tone="accent">conversation active</StatusPill>
					) : null}
					{conversation.pendingApprovals.length > 0 ? (
						<StatusPill tone="watch">{conversation.pendingApprovals.length} pending</StatusPill>
					) : null}
				</div>

				<div className="flex min-h-0 flex-1 flex-col">
					<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-5 pr-1">
						{conversation.messages.length > 0 ? (
							conversation.messages.map((message) => (
								<article
									className={`rounded-lg border p-5 ${
										message.role === "assistant"
											? "border-zinc-950/5 bg-zinc-50 dark:border-white/10 dark:bg-zinc-800"
											: "border-zinc-950/5 bg-white dark:border-white/10 dark:bg-zinc-900"
									}`}
									key={message.id}
								>
									<div className="flex flex-wrap items-center gap-3">
										<StatusPill tone={message.role === "assistant" ? "accent" : "neutral"}>
											{message.role}
										</StatusPill>
										<StatusPill tone="neutral">{formatTimestamp(message.createdAt)}</StatusPill>
										{message.toolNames.map((toolName) => (
											<StatusPill key={`${message.id}-${toolName}`} tone="watch">
												{toolName}
											</StatusPill>
										))}
									</div>

									<Text className="mt-4">{message.body}</Text>

									{message.dashboard ? (
										<div className="mt-5">
											<MerchantDashboard dashboard={message.dashboard} />
										</div>
									) : null}

									{message.approvals.length > 0 ? (
										<div className="mt-5">
											<MerchantApprovalCards
												activeApprovalId={activeApprovalId}
												approvals={message.approvals}
												emptyBody="No approvals are attached to this message."
												emptyTitle="No approvals"
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
											/>
										</div>
									) : null}

									<MerchantCitationList citations={message.citations} />
								</article>
							))
						) : (
							<div className="flex flex-1 items-center">
								<EmptyState
									body="Ask about products, orders, inventory, documents, or stage a workflow or Shopify write for approval."
									title="Start the conversation"
								/>
							</div>
						)}
					</div>

					<form
						className="border-t border-zinc-950/5 pt-4 dark:border-white/10"
						onSubmit={(event) => {
							event.preventDefault();
							void form.handleSubmit();
						}}
					>
						<form.Field name="prompt">
							{(field) => (
								<Textarea
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									placeholder='Show me low-stock items, summarize the returns SOP, or draft an approval to pause "Unicorn Sparkle Backpack".'
									rows={4}
									value={field.state.value}
								/>
							)}
						</form.Field>

						<div className="mt-4 flex flex-wrap items-center gap-3">
							<Button color="dark/zinc" disabled={isWorking} type="submit">
								{askMutation.isPending ? "Working..." : "Ask copilot"}
							</Button>
							{askMutation.error ? (
								<Text className="text-rose-600 dark:text-rose-400">
									{askMutation.error.message}
								</Text>
							) : null}
						</div>
					</form>
				</div>
			</Panel>
		</div>
	);
}
