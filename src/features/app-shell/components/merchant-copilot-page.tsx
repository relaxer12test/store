import { useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/cata/button";
import { Field, Fieldset, Label } from "@/components/ui/cata/fieldset";
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
import type { Id } from "../../../../convex/_generated/dataModel";

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
		<div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
			<div className="grid gap-5">
				<Panel
					description="The merchant copilot answers from live Shopify reads, shop-private documents, and Convex workflow history. Any proposed write stays as an approval card until you explicitly approve it."
					title="Merchant copilot"
				>
					<Fieldset>
						<form
							onSubmit={(event) => {
								event.preventDefault();
								void form.handleSubmit();
							}}
						>
							<form.Field name="prompt">
								{(field) => (
									<Field>
										<Label>Ask an operational question</Label>
										<Textarea
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											placeholder='Show me low-stock items, summarize the returns SOP, or draft an approval to pause "Unicorn Sparkle Backpack".'
											rows={4}
											value={field.state.value}
										/>
									</Field>
								)}
							</form.Field>

							<div className="mt-4 flex flex-wrap items-center gap-3">
								<Button color="dark/zinc" disabled={isWorking} type="submit">
									{askMutation.isPending ? "Working..." : "Ask copilot"}
								</Button>
								<StatusPill tone={isWorking ? "watch" : "neutral"}>{activityLabel}</StatusPill>
								{conversation.conversationId ? (
									<StatusPill tone="accent">conversation active</StatusPill>
								) : null}
							</div>
						</form>
					</Fieldset>

					{askMutation.error ? (
						<div className="mt-5">
							<EmptyState body={askMutation.error.message} title="Copilot request failed" />
						</div>
					) : null}
				</Panel>

				<Panel
					description="Structured results stay inside the conversation history so operational answers, dashboards, and approvals are auditable in one place."
					title="Conversation feed"
				>
					{conversation.messages.length > 0 ? (
						<div className="space-y-4">
							{conversation.messages.map((message) => (
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
							))}
						</div>
					) : (
						<EmptyState
							body="Use a quick prompt or ask about products, orders, inventory, documents, or a workflow you want staged for approval."
							title="No conversation yet"
						/>
					)}
				</Panel>
			</div>

			<div className="grid gap-5">
				<Panel
					description="The latest dashboard remains visible outside the chat feed so the merchant surface stays useful even while the assistant is idle."
					title="Latest dashboard"
				>
					{conversation.latestDashboard ? (
						<MerchantDashboard dashboard={conversation.latestDashboard} />
					) : (
						<EmptyState
							body="Ask for a dashboard, sales summary, inventory review, or document summary to populate this surface."
							title="No dashboard rendered yet"
						/>
					)}
				</Panel>

				<Panel
					description="Only explicit merchant approval can execute Shopify mutations. Rejections are audited just like approvals."
					title="Pending actions"
				>
					<MerchantApprovalCards
						activeApprovalId={activeApprovalId}
						approvals={conversation.pendingApprovals}
						emptyBody="The copilot has not staged any pending write actions right now."
						emptyTitle="No pending actions"
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
				</Panel>

				<Panel
					description="These prompts are phrased the way a merchant would naturally ask them. Each one uses the same deterministic backend tools as freeform prompts."
					title="Quick prompts"
				>
					<div className="flex flex-wrap gap-3">
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
				</Panel>
			</div>
		</div>
	);
}
