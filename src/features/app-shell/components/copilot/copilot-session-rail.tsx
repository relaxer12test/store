import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/cata/button";
import { Input } from "@/components/ui/cata/input";
import { Strong, Text } from "@/components/ui/cata/text";
import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { cn } from "@/lib/cn";
import type { MerchantCopilotSessionSummary } from "@/shared/contracts/merchant-workspace";

function formatSessionTimestamp(value: string) {
	const parsed = Date.parse(value);

	if (!Number.isFinite(parsed)) {
		return value;
	}

	const date = new Date(parsed);
	const now = new Date();
	const sameDay = date.toDateString() === now.toDateString();

	return sameDay
		? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
		: date.toLocaleDateString();
}

function sessionPreview(session: MerchantCopilotSessionSummary) {
	return session.lastAssistantSummary ?? session.lastPromptPreview ?? "No messages yet";
}

export function CopilotSessionRail({
	activeConversationId,
	deleteError,
	deletePendingConversationId,
	editTitle,
	editingConversationId,
	isCreating,
	isRenaming,
	onCreateConversation,
	onDeleteConversation,
	onRenameCancel,
	onRenameChange,
	onRenameConversation,
	onRenameStart,
	onSelectConversation,
	renameError,
	sessions,
}: {
	activeConversationId: string | null;
	deleteError: Error | null;
	deletePendingConversationId: string | null;
	editTitle: string;
	editingConversationId: string | null;
	isCreating: boolean;
	isRenaming: boolean;
	onCreateConversation: () => void;
	onDeleteConversation: (conversationId: string) => void;
	onRenameCancel: () => void;
	onRenameChange: (value: string) => void;
	onRenameConversation: (conversationId: string) => void;
	onRenameStart: (session: MerchantCopilotSessionSummary) => void;
	onSelectConversation: (conversationId: string) => void;
	renameError: Error | null;
	sessions: MerchantCopilotSessionSummary[];
}) {
	return (
		<Panel
			className="flex h-full min-h-0 max-h-none flex-col overflow-hidden"
			description="Start a fresh chat, jump back into prior threads, or clean up stale conversations."
			title="Sessions"
		>
			<div className="mb-4 flex items-center justify-between gap-3">
				<Text>{sessions.length} conversation(s)</Text>
				<Button
					color="dark/zinc"
					disabled={isCreating}
					onClick={onCreateConversation}
					type="button"
				>
					<Plus data-slot="icon" />
					{isCreating ? "Creating..." : "New chat"}
				</Button>
			</div>

			{renameError ? (
				<Text className="mb-3 text-rose-600 dark:text-rose-400">{renameError.message}</Text>
			) : null}
			{deleteError ? (
				<Text className="mb-3 text-rose-600 dark:text-rose-400">{deleteError.message}</Text>
			) : null}

			{sessions.length === 0 ? (
				<EmptyState
					body="Start a chat to create the first merchant copilot session."
					title="No sessions yet"
				/>
			) : (
				<div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
					{sessions.map((session) => {
						const isActive = session.conversationId === activeConversationId;
						const isDeleting = deletePendingConversationId === session.conversationId;
						const isEditing = editingConversationId === session.conversationId;

						return (
							<div
								className={cn(
									"rounded-lg border p-3 transition-colors",
									isActive
										? "border-zinc-950/15 bg-zinc-100 dark:border-white/15 dark:bg-zinc-800"
										: "border-zinc-950/5 bg-zinc-50 dark:border-white/10 dark:bg-zinc-900",
								)}
								key={session.conversationId}
							>
								{isEditing ? (
									<div className="space-y-3">
										<Input
											autoFocus
											disabled={isRenaming}
											onChange={(event) => onRenameChange(event.target.value)}
											onKeyDown={(event) => {
												if (event.key === "Enter") {
													event.preventDefault();
													onRenameConversation(session.conversationId);
												}

												if (event.key === "Escape") {
													event.preventDefault();
													onRenameCancel();
												}
											}}
											value={editTitle}
										/>
										<div className="flex gap-2">
											<Button
												color="dark/zinc"
												disabled={isRenaming}
												onClick={() => onRenameConversation(session.conversationId)}
												type="button"
											>
												{isRenaming ? "Saving..." : "Save"}
											</Button>
											<Button disabled={isRenaming} onClick={onRenameCancel} outline type="button">
												<X data-slot="icon" />
												Cancel
											</Button>
										</div>
									</div>
								) : (
									<>
										<button
											className="block w-full cursor-default text-left"
											onClick={() => onSelectConversation(session.conversationId)}
											type="button"
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0">
													<Strong className="block truncate">{session.title}</Strong>
													<Text className="mt-1 line-clamp-2">{sessionPreview(session)}</Text>
												</div>
												<div className="shrink-0 text-right">
													<Text className="text-xs">
														{formatSessionTimestamp(session.updatedAt)}
													</Text>
													{session.pendingApprovalCount > 0 ? (
														<StatusPill className="mt-2" tone="watch">
															{session.pendingApprovalCount} waiting
														</StatusPill>
													) : null}
												</div>
											</div>
										</button>

										<div className="mt-3 flex items-center justify-between gap-2">
											<Text className="text-xs">
												Created {formatSessionTimestamp(session.createdAt)}
											</Text>
											<div className="flex gap-2">
												<Button
													disabled={isDeleting}
													onClick={() => onRenameStart(session)}
													plain
													type="button"
												>
													<Pencil data-slot="icon" />
													Rename
												</Button>
												<Button
													disabled={isDeleting}
													onClick={() => onDeleteConversation(session.conversationId)}
													plain
													type="button"
												>
													<Trash2 data-slot="icon" />
													{isDeleting ? "Deleting..." : "Delete"}
												</Button>
											</div>
										</div>
									</>
								)}
							</div>
						);
					})}
				</div>
			)}
		</Panel>
	);
}
