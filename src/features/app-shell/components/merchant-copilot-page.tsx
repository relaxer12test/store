import { useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

const primaryButtonClass =
	"inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
	"inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const inputClass =
	"w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400";

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
	initialConversation,
}: {
	initialConversation: MerchantCopilotConversation;
}) {
	const queryClient = useQueryClient();
	const requestCopilot = useConvexAction(api.merchantWorkspace.askCopilot);
	const approveAction = useConvexAction(api.merchantWorkspace.approveAction);
	const rejectAction = useConvexMutation(api.merchantWorkspace.rejectAction);
	const [conversation, setConversation] = useState(initialConversation);
	const [prompt, setPrompt] = useState("");
	const [activeApprovalId, setActiveApprovalId] = useState<string | null>(null);
	const askMutation = useMutation({
		mutationFn: requestCopilot,
		onSuccess: async (nextConversation) => {
			setConversation(nextConversation);
			queryClient.setQueryData(merchantCopilotStateQuery.queryKey, nextConversation);
			await invalidateMerchantWorkspaceQueries(queryClient);
		},
	});
	const approveMutation = useMutation({
		mutationFn: approveAction,
		onMutate: ({ approvalId }) => {
			setActiveApprovalId(approvalId);
		},
		onSuccess: async () => {
			await invalidateMerchantWorkspaceQueries(queryClient);
			setConversation(await refreshConversationState(queryClient));
		},
		onSettled: () => {
			setActiveApprovalId(null);
		},
	});
	const rejectMutation = useMutation({
		mutationFn: rejectAction,
		onMutate: ({ approvalId }) => {
			setActiveApprovalId(approvalId);
		},
		onSuccess: async () => {
			await invalidateMerchantWorkspaceQueries(queryClient);
			setConversation(await refreshConversationState(queryClient));
		},
		onSettled: () => {
			setActiveApprovalId(null);
		},
	});

	useEffect(() => {
		setConversation(initialConversation);
	}, [initialConversation]);

	function submitPrompt(nextPrompt = prompt) {
		const normalizedPrompt = nextPrompt.trim();

		if (normalizedPrompt.length < 4) {
			return;
		}

		setPrompt("");
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
					<form
						className="grid gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							submitPrompt();
						}}
					>
						<label className="grid gap-2">
							<span className="text-sm font-semibold text-slate-900">
								Ask an operational question
							</span>
							<textarea
								className={`${inputClass} min-h-28`}
								onChange={(event) => setPrompt(event.target.value)}
								placeholder='Show me low-stock items, summarize the returns SOP, or draft an approval to pause "Unicorn Sparkle Backpack".'
								value={prompt}
							/>
						</label>

						<div className="flex flex-wrap items-center gap-3">
							<button className={primaryButtonClass} disabled={isWorking} type="submit">
								{askMutation.isPending ? "Working..." : "Ask copilot"}
							</button>
							<StatusPill tone={isWorking ? "watch" : "neutral"}>{activityLabel}</StatusPill>
							{conversation.conversationId ? (
								<StatusPill tone="accent">conversation active</StatusPill>
							) : null}
						</div>
					</form>

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
									className={`rounded-[1.4rem] border p-5 ${
										message.role === "assistant"
											? "border-slate-200 bg-slate-50"
											: "border-slate-200 bg-white"
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

									<p className="mt-4 text-sm leading-7 text-slate-900">{message.body}</p>

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
							<button
								className={secondaryButtonClass}
								disabled={isWorking}
								key={quickPrompt}
								onClick={() => submitPrompt(quickPrompt)}
								type="button"
							>
								{quickPrompt}
							</button>
						))}
					</div>
				</Panel>
			</div>
		</div>
	);
}
