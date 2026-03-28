import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Text } from "@/components/ui/cata/text";
import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import {
	CodeValue,
	formatTimestampLabel,
	ResourceDetailPage,
	StatusValue,
} from "@/components/ui/resource";
import {
	getInternalAiSessionDetailQuery,
	getInternalAiTranscriptPageQuery,
} from "@/features/internal/internal-admin-queries";
import { validateInternalAiSessionDetailSearch } from "@/features/internal/internal-admin-route-state";
import {
	buildNextInternalCursorState,
	buildPreviousInternalCursorState,
} from "@/features/internal/internal-admin-search";

export const Route = createFileRoute("/_app/internal/ai-sessions/$sessionDocumentId")({
	validateSearch: validateInternalAiSessionDetailSearch,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps, params }) => {
		await Promise.all([
			context.preload.ensureQueryData(getInternalAiSessionDetailQuery(params.sessionDocumentId)),
			context.preload.ensureQueryData(
				getInternalAiTranscriptPageQuery(deps, params.sessionDocumentId),
			),
		]);
	},
	component: InternalAiSessionDetailRoute,
});

function InternalAiSessionDetailRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const { sessionDocumentId } = Route.useParams();
	const search = Route.useSearch();
	const { data } = useSuspenseQuery(getInternalAiSessionDetailQuery(sessionDocumentId));
	const transcriptQuery = useSuspenseQuery(
		getInternalAiTranscriptPageQuery(search, sessionDocumentId),
	);

	if (!data) {
		return (
			<ResourceDetailPage backHref="/internal/ai-sessions" title="Session detail unavailable">
				<EmptyState
					body="The selected storefront AI session could not be loaded."
					title="Unavailable"
				/>
			</ResourceDetailPage>
		);
	}

	const { session } = data;

	return (
		<ResourceDetailPage
			backHref="/internal/ai-sessions"
			description={`${session.threadStatus} · ${session.lastReplyTone ?? "no reply"}`}
			title={session.shopName}
		>
			<DescriptionList>
				<DescriptionTerm>Shop domain</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={session.shopDomain} />
				</DescriptionDetails>
				<DescriptionTerm>Session id</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={session.sessionId} />
				</DescriptionDetails>
				<DescriptionTerm>Thread id</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={session.threadId} />
				</DescriptionDetails>
				<DescriptionTerm>Client fingerprint</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={session.clientFingerprint} />
				</DescriptionDetails>
				<DescriptionTerm>Created</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(session.createdAt)}</DescriptionDetails>
				<DescriptionTerm>Updated</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(session.updatedAt)}</DescriptionDetails>
				<DescriptionTerm>Last prompt</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(session.lastPromptAt)}</DescriptionDetails>
				<DescriptionTerm>Last reply</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(session.lastReplyAt)}</DescriptionDetails>
			</DescriptionList>

			<Panel title="Session state">
				<Text>{session.lastPromptPreview ?? "No prompt preview recorded."}</Text>
				<Text className="mt-2 text-zinc-600 dark:text-zinc-300">
					{session.lastReplyPreview ?? "No assistant reply preview recorded yet."}
				</Text>
				{session.lastRefusalReason ? (
					<Text className="mt-3 text-amber-700 dark:text-amber-300">
						{session.lastRefusalReason}
					</Text>
				) : null}
				{session.threadError ? (
					<Text className="mt-3 text-red-700 dark:text-red-300">{session.threadError}</Text>
				) : null}
			</Panel>

			<Panel title="Transcript">
				<div className="flex items-center justify-end gap-2">
					<button
						className="rounded-lg border border-zinc-950/10 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-40 dark:border-white/10 dark:text-white"
						disabled={!search.transcriptPrev}
						onClick={() => {
							const previous = buildPreviousInternalCursorState({
								cursor: search.transcriptCursor,
								dir: "desc",
								limit: search.transcriptLimit,
								prev: search.transcriptPrev,
								sort: "updatedAt",
							});

							void navigate({
								search: (current) => ({
									...current,
									transcriptCursor: previous.cursor,
									transcriptPrev: previous.prev,
								}),
							});
						}}
						type="button"
					>
						Newer
					</button>
					<button
						className="rounded-lg border border-zinc-950/10 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 dark:border-white/10 dark:bg-white dark:text-zinc-950"
						disabled={!transcriptQuery.data?.pageInfo.continueCursor}
						onClick={() => {
							const next = buildNextInternalCursorState(
								{
									cursor: search.transcriptCursor,
									dir: "desc",
									limit: search.transcriptLimit,
									prev: search.transcriptPrev,
									sort: "updatedAt",
								},
								transcriptQuery.data?.pageInfo.continueCursor ?? null,
							);

							void navigate({
								search: (current) => ({
									...current,
									transcriptCursor: next.cursor,
									transcriptPrev: next.prev,
								}),
							});
						}}
						type="button"
					>
						Older
					</button>
				</div>

				{transcriptQuery.data.messages.length === 0 ? (
					<Text>No transcript messages were found for this session.</Text>
				) : (
					<div className="space-y-3">
						{transcriptQuery.data.messages.map((message) => (
							<article
								className="rounded-lg border border-zinc-950/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
								key={message.id}
							>
								<div className="flex flex-wrap items-center gap-2">
									<StatusValue value={message.role} />
									<StatusValue value={message.status} />
									<Text className="text-xs text-zinc-500 dark:text-zinc-400">
										{formatTimestampLabel(message.createdAt)}
									</Text>
								</div>
								<Text className="mt-3 whitespace-pre-wrap">{message.body}</Text>
								{message.error ? (
									<Text className="mt-3 text-red-700 dark:text-red-300">{message.error}</Text>
								) : null}
							</article>
						))}
					</div>
				)}
			</Panel>
		</ResourceDetailPage>
	);
}
