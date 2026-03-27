import { useQuery } from "@tanstack/react-query";
import { useDeferredValue } from "react";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Input } from "@/components/ui/cata/input";
import { Text } from "@/components/ui/cata/text";
import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import {
	getInternalStorefrontAiTranscriptQuery,
	internalStorefrontAiSessionsQuery,
} from "@/features/internal/internal-storefront-ai";

function formatTimestampLabel(value: string | null) {
	if (!value) {
		return "n/a";
	}

	const parsed = Date.parse(value);

	return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
}

function getRoleTone(role: "assistant" | "system" | "tool" | "user") {
	switch (role) {
		case "assistant":
			return "accent";
		case "system":
			return "watch";
		case "tool":
			return "neutral";
		case "user":
			return "neutral";
	}
}

function getStatusTone(status: "failed" | "pending" | "success") {
	switch (status) {
		case "failed":
			return "blocked";
		case "pending":
			return "watch";
		case "success":
			return "success";
	}
}

function getThreadTone(status: "active" | "archived" | "missing") {
	switch (status) {
		case "active":
			return "success";
		case "archived":
			return "neutral";
		case "missing":
			return "blocked";
	}
}

function getReplyTone(tone: "answer" | "refusal" | null) {
	switch (tone) {
		case "answer":
			return "success";
		case "refusal":
			return "watch";
		default:
			return "neutral";
	}
}

export function InternalAiChatPage({
	onSearchChange,
	onSessionChange,
	searchQuery,
	selectedSessionId,
}: {
	onSearchChange: (query: string) => void;
	onSessionChange: (sessionId: string) => void;
	searchQuery: string;
	selectedSessionId: string | null;
}) {
	const sessionsQuery = useQuery(internalStorefrontAiSessionsQuery);
	const deferredSearchValue = useDeferredValue(searchQuery);
	const normalizedSearch = deferredSearchValue.trim().toLowerCase();
	const sessionsData = sessionsQuery.data;
	const filteredSessions = (sessionsData?.sessions ?? []).filter((session) => {
		if (normalizedSearch.length === 0) {
			return true;
		}

		return [
			session.shopName,
			session.shopDomain,
			session.sessionId,
			session.threadId,
			session.clientFingerprint ?? "",
			session.lastPromptPreview ?? "",
			session.lastReplyPreview ?? "",
			session.lastRefusalReason ?? "",
		]
			.join(" ")
			.toLowerCase()
			.includes(normalizedSearch);
	});
	const selectedFromFilter = filteredSessions.find((session) => session.id === selectedSessionId);
	const activeSessionId = selectedFromFilter?.id ?? filteredSessions[0]?.id ?? null;
	const transcript = useQuery({
		...getInternalStorefrontAiTranscriptQuery(activeSessionId ?? "skip"),
		enabled: Boolean(activeSessionId),
		placeholderData: (previousData) => previousData ?? null,
	});

	if (sessionsQuery.isPending) {
		return <Text>Loading storefront AI sessions…</Text>;
	}

	if (sessionsQuery.isError || !sessionsData) {
		return (
			<Text className="text-red-600 dark:text-red-500">
				Failed to load storefront AI sessions.
			</Text>
		);
	}

	return (
		<div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
			<Panel
				description="Every stored storefront widget session is listed here with the latest prompt and assistant reply preview. Use search to narrow by shop, prompt text, session id, or thread id."
				title="Storefront AI sessions"
			>
				<div className="flex items-center gap-3">
					<StatusPill tone="neutral">{`${filteredSessions.length} visible`}</StatusPill>
					<StatusPill tone="accent">{`${sessionsData.sessions.length} recent sessions`}</StatusPill>
				</div>

				<div className="mt-5">
					<Input
						onChange={(event) => onSearchChange(event.target.value)}
						placeholder="Search sessions"
						value={searchQuery}
					/>
				</div>

				{filteredSessions.length === 0 ? (
					<div className="mt-5">
						<EmptyState
							body="No storefront AI session matched the current search."
							title="No matching sessions"
						/>
					</div>
				) : (
					<div className="mt-5 max-h-[70vh] space-y-3 overflow-y-auto pr-1">
						{filteredSessions.map((session) => {
							const isSelected = session.id === activeSessionId;

							return (
								<button
									className={`w-full rounded-lg border p-4 text-left transition ${
										isSelected
											? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
											: "border-zinc-950/5 bg-zinc-50 text-zinc-900 hover:border-zinc-300 hover:bg-white dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-white/20"
									}`}
									key={session.id}
									onClick={() => onSessionChange(session.id)}
									type="button"
								>
									<div className="flex flex-wrap items-center gap-2">
										<StatusPill
											className={isSelected ? "border-white/20 bg-white/10 text-white" : undefined}
											tone={getReplyTone(session.lastReplyTone)}
										>
											{session.lastReplyTone ?? "no reply"}
										</StatusPill>
										{session.lastRefusalReason ? (
											<StatusPill
												className={
													isSelected ? "border-white/20 bg-white/10 text-white" : undefined
												}
												tone="watch"
											>
												{session.lastRefusalReason}
											</StatusPill>
										) : null}
									</div>

									<div className="mt-3">
										<p className="font-semibold">{session.shopName}</p>
										<p
											className={`text-sm ${isSelected ? "text-white/70" : "text-zinc-500 dark:text-zinc-400"}`}
										>
											{session.shopDomain}
										</p>
									</div>

									<div className="mt-4 space-y-3 text-sm leading-6">
										<div>
											<p
												className={
													isSelected ? "text-white/60" : "text-zinc-500 dark:text-zinc-400"
												}
											>
												Prompt
											</p>
											<p>{session.lastPromptPreview ?? "No prompt preview recorded."}</p>
										</div>
										<div>
											<p
												className={
													isSelected ? "text-white/60" : "text-zinc-500 dark:text-zinc-400"
												}
											>
												Reply
											</p>
											<p>{session.lastReplyPreview ?? "No assistant reply recorded yet."}</p>
										</div>
									</div>

									<p
										className={`mt-4 text-xs font-semibold uppercase tracking-[0.18em] ${
											isSelected ? "text-white/65" : "text-zinc-500 dark:text-zinc-400"
										}`}
									>
										Updated {formatTimestampLabel(session.updatedAt)}
									</p>
								</button>
							);
						})}
					</div>
				)}
			</Panel>

			<div className="grid gap-5">
				<Panel
					description="The selected session exposes the persisted storefront session row together with the linked agent thread metadata."
					title="Selected session"
				>
					{transcript.isError ? (
						<EmptyState
							body={
								transcript.error instanceof Error
									? transcript.error.message
									: "The selected transcript could not be loaded."
							}
							title="Transcript unavailable"
						/>
					) : !transcript.data ? (
						<EmptyState
							body="Select a storefront AI session from the list to inspect its transcript."
							title="No session selected"
						/>
					) : (
						<div className="grid gap-5">
							<div className="flex flex-wrap items-center gap-2">
								<StatusPill tone={getThreadTone(transcript.data.threadStatus)}>
									{`thread ${transcript.data.threadStatus}`}
								</StatusPill>
								<StatusPill tone={getReplyTone(transcript.data.lastReplyTone)}>
									{transcript.data.lastReplyTone ?? "no reply"}
								</StatusPill>
								{transcript.data.lastRefusalReason ? (
									<StatusPill tone="watch">{transcript.data.lastRefusalReason}</StatusPill>
								) : null}
								{transcript.isFetching ? (
									<StatusPill tone="accent">refreshing transcript</StatusPill>
								) : null}
								{transcript.data.messagesTruncated ? (
									<StatusPill tone="watch">showing first 500 messages</StatusPill>
								) : null}
							</div>

							<DescriptionList>
								<DescriptionTerm>Shop</DescriptionTerm>
								<DescriptionDetails>{`${transcript.data.shopName} (${transcript.data.shopDomain})`}</DescriptionDetails>
								<DescriptionTerm>Session id</DescriptionTerm>
								<DescriptionDetails className="break-all font-mono text-xs">
									{transcript.data.sessionId}
								</DescriptionDetails>
								<DescriptionTerm>Thread id</DescriptionTerm>
								<DescriptionDetails className="break-all font-mono text-xs">
									{transcript.data.threadId}
								</DescriptionDetails>
								<DescriptionTerm>Thread title</DescriptionTerm>
								<DescriptionDetails>{transcript.data.threadTitle ?? "n/a"}</DescriptionDetails>
								<DescriptionTerm>Thread user key</DescriptionTerm>
								<DescriptionDetails className="break-all font-mono text-xs">
									{transcript.data.threadUserId ?? "n/a"}
								</DescriptionDetails>
								<DescriptionTerm>Client fingerprint</DescriptionTerm>
								<DescriptionDetails className="break-all font-mono text-xs">
									{transcript.data.clientFingerprint ?? "n/a"}
								</DescriptionDetails>
								<DescriptionTerm>Created</DescriptionTerm>
								<DescriptionDetails>
									{formatTimestampLabel(transcript.data.createdAt)}
								</DescriptionDetails>
								<DescriptionTerm>Updated</DescriptionTerm>
								<DescriptionDetails>
									{formatTimestampLabel(transcript.data.updatedAt)}
								</DescriptionDetails>
								<DescriptionTerm>Last prompt</DescriptionTerm>
								<DescriptionDetails>
									{formatTimestampLabel(transcript.data.lastPromptAt)}
								</DescriptionDetails>
								<DescriptionTerm>Last reply</DescriptionTerm>
								<DescriptionDetails>
									{formatTimestampLabel(transcript.data.lastReplyAt)}
								</DescriptionDetails>
								<DescriptionTerm>Cards in last reply</DescriptionTerm>
								<DescriptionDetails>{transcript.data.lastCardCount}</DescriptionDetails>
								<DescriptionTerm>Cart items in last plan</DescriptionTerm>
								<DescriptionDetails>{transcript.data.lastCartPlanItemCount}</DescriptionDetails>
							</DescriptionList>

							<div className="grid gap-4 lg:grid-cols-2">
								<article className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800">
									<Text className="text-xs font-semibold uppercase tracking-[0.2em]">
										Last prompt preview
									</Text>
									<Text className="mt-3">
										{transcript.data.lastPromptPreview ?? "No prompt preview recorded."}
									</Text>
								</article>
								<article className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800">
									<Text className="text-xs font-semibold uppercase tracking-[0.2em]">
										Last reply preview
									</Text>
									<Text className="mt-3">
										{transcript.data.lastReplyPreview ?? "No assistant reply preview recorded."}
									</Text>
								</article>
							</div>

							{transcript.data.threadError ? (
								<Text className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
									{transcript.data.threadError}
								</Text>
							) : null}
						</div>
					)}
				</Panel>

				<Panel
					description="These messages come from the persisted `@convex-dev/agent` thread linked to the storefront session. Tool-call rows are hidden so the shopper dialogue stays readable."
					title="Transcript"
				>
					{transcript.isError ? (
						<EmptyState
							body="The transcript could not be loaded for the selected session."
							title="Transcript unavailable"
						/>
					) : !transcript.data ? (
						<EmptyState
							body="Select a storefront AI session to inspect the message history."
							title="No transcript loaded"
						/>
					) : transcript.data.messages.length === 0 ? (
						<EmptyState
							body="The linked agent thread does not currently expose any stored user or assistant messages."
							title="No transcript messages"
						/>
					) : (
						<div className="space-y-4">
							{transcript.data.messages.map((message) => (
								<article
									className={`rounded-lg border p-5 ${
										message.role === "assistant"
											? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
											: message.role === "system"
												? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
												: "border-zinc-950/5 bg-zinc-50 dark:border-white/10 dark:bg-zinc-800"
									}`}
									key={message.id}
								>
									<div className="flex flex-wrap items-center gap-2">
										<StatusPill tone={getRoleTone(message.role)}>{message.role}</StatusPill>
										<StatusPill tone={getStatusTone(message.status)}>{message.status}</StatusPill>
										<StatusPill tone="neutral">
											{formatTimestampLabel(message.createdAt)}
										</StatusPill>
										<StatusPill tone="neutral">{`order ${message.order}.${message.stepOrder}`}</StatusPill>
										{message.provider ? (
											<StatusPill tone="neutral">{message.provider}</StatusPill>
										) : null}
										{message.model ? <StatusPill tone="neutral">{message.model}</StatusPill> : null}
									</div>

									<Text className="mt-4 whitespace-pre-wrap">{message.body}</Text>

									{message.error ? (
										<Text className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
											{message.error}
										</Text>
									) : null}
								</article>
							))}
						</div>
					)}
				</Panel>
			</div>
		</div>
	);
}
