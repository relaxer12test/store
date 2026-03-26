import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";
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

export function InternalAiChatPage() {
	const { data: sessionsData } = useSuspenseQuery(internalStorefrontAiSessionsQuery);
	const [searchValue, setSearchValue] = useState("");
	const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
	const deferredSearchValue = useDeferredValue(searchValue);
	const normalizedSearch = deferredSearchValue.trim().toLowerCase();
	const filteredSessions = sessionsData.sessions.filter((session) => {
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
		placeholderData: (previousData) => previousData ?? null,
	});

	useEffect(() => {
		if (
			selectedSessionId &&
			sessionsData.sessions.some((session) => session.id === selectedSessionId)
		) {
			return;
		}

		setSelectedSessionId(sessionsData.sessions[0]?.id ?? null);
	}, [selectedSessionId, sessionsData.sessions]);

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

				<input
					className="mt-5 w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
					onChange={(event) => setSearchValue(event.target.value)}
					placeholder="Search sessions"
					value={searchValue}
				/>

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
									className={`w-full rounded-[1.25rem] border p-4 text-left transition ${
										isSelected
											? "border-slate-900 bg-slate-900 text-white"
											: "border-slate-200 bg-slate-50 text-slate-900 hover:border-slate-300 hover:bg-white"
									}`}
									key={session.id}
									onClick={() => setSelectedSessionId(session.id)}
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
										<p className={isSelected ? "text-sm text-white/70" : "text-sm text-slate-600"}>
											{session.shopDomain}
										</p>
									</div>

									<div className="mt-4 space-y-3 text-sm leading-6">
										<div>
											<p className={isSelected ? "text-white/60" : "text-slate-500"}>Prompt</p>
											<p>{session.lastPromptPreview ?? "No prompt preview recorded."}</p>
										</div>
										<div>
											<p className={isSelected ? "text-white/60" : "text-slate-500"}>Reply</p>
											<p>{session.lastReplyPreview ?? "No assistant reply recorded yet."}</p>
										</div>
									</div>

									<p
										className={`mt-4 text-xs font-semibold uppercase tracking-[0.18em] ${
											isSelected ? "text-white/65" : "text-slate-500"
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

							<dl className="grid gap-3 text-sm leading-6 text-slate-600 md:grid-cols-2">
								<div>
									<dt className="font-semibold text-slate-900">Shop</dt>
									<dd>{`${transcript.data.shopName} (${transcript.data.shopDomain})`}</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Session id</dt>
									<dd className="break-all font-mono text-xs">{transcript.data.sessionId}</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Thread id</dt>
									<dd className="break-all font-mono text-xs">{transcript.data.threadId}</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Thread title</dt>
									<dd>{transcript.data.threadTitle ?? "n/a"}</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Thread user key</dt>
									<dd className="break-all font-mono text-xs">
										{transcript.data.threadUserId ?? "n/a"}
									</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Client fingerprint</dt>
									<dd className="break-all font-mono text-xs">
										{transcript.data.clientFingerprint ?? "n/a"}
									</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Created</dt>
									<dd>{formatTimestampLabel(transcript.data.createdAt)}</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Updated</dt>
									<dd>{formatTimestampLabel(transcript.data.updatedAt)}</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Last prompt</dt>
									<dd>{formatTimestampLabel(transcript.data.lastPromptAt)}</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Last reply</dt>
									<dd>{formatTimestampLabel(transcript.data.lastReplyAt)}</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Cards in last reply</dt>
									<dd>{transcript.data.lastCardCount}</dd>
								</div>
								<div>
									<dt className="font-semibold text-slate-900">Cart items in last plan</dt>
									<dd>{transcript.data.lastCartPlanItemCount}</dd>
								</div>
							</dl>

							<div className="grid gap-4 lg:grid-cols-2">
								<article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
										Last prompt preview
									</p>
									<p className="mt-3 text-sm leading-7 text-slate-900">
										{transcript.data.lastPromptPreview ?? "No prompt preview recorded."}
									</p>
								</article>
								<article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
									<p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
										Last reply preview
									</p>
									<p className="mt-3 text-sm leading-7 text-slate-900">
										{transcript.data.lastReplyPreview ?? "No assistant reply preview recorded."}
									</p>
								</article>
							</div>

							{transcript.data.threadError ? (
								<p className="rounded-[1.25rem] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
									{transcript.data.threadError}
								</p>
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
									className={`rounded-[1.35rem] border p-5 ${
										message.role === "assistant"
											? "border-blue-200 bg-blue-50"
											: message.role === "system"
												? "border-amber-200 bg-amber-50"
												: "border-slate-200 bg-slate-50"
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

									<p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-900">
										{message.body}
									</p>

									{message.error ? (
										<p className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800">
											{message.error}
										</p>
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
