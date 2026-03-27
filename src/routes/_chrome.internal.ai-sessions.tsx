import { useQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import {
	InternalCodeValue,
	InternalStatusValue,
	formatInternalTimestamp,
} from "@/components/ui/resource";
import { InternalResourceLayout } from "@/components/ui/resource";
import {
	InternalResourceTable,
	InternalResourceToolbar,
	type InternalTableColumn,
} from "@/components/ui/resource";
import { getInternalAiSessionsQuery } from "@/features/internal/internal-admin-queries";
import {
	type InternalAiSessionSort,
	validateInternalAiSessionSearch,
} from "@/features/internal/internal-admin-route-state";
import {
	advanceInternalPage,
	buildInternalHref,
	formatInternalSortValue,
	parseInternalSortValue,
	resetInternalPagination,
	rewindInternalPage,
} from "@/features/internal/internal-admin-routing";
import { INTERNAL_PAGE_SIZE_OPTIONS } from "@/features/internal/internal-admin-search";
import type { InternalAiSessionSummary } from "@/shared/contracts/internal-admin";

const aiSessionColumns: InternalTableColumn<InternalAiSessionSummary>[] = [
	{
		cell: (row) => (
			<div>
				<Text className="font-semibold text-zinc-950 dark:text-white">{row.shopName}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">{row.shopDomain}</Text>
			</div>
		),
		header: "Shop",
	},
	{
		cell: (row) => (
			<div className="space-y-1">
				<InternalCodeValue value={row.sessionId} />
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">{row.threadId}</Text>
			</div>
		),
		header: "Session",
	},
	{
		cell: (row) => <InternalStatusValue value={row.lastReplyTone ?? "no reply"} />,
		header: "Reply",
	},
	{
		cell: (row) => (
			<div className="space-y-1">
				<Text>{row.lastPromptPreview ?? "No prompt preview"}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">
					updated {formatInternalTimestamp(row.updatedAt)}
				</Text>
			</div>
		),
		header: "Latest prompt",
	},
];

const aiSessionSortOptions = [
	{
		label: "Latest updated",
		value: formatInternalSortValue("updatedAt", "desc"),
	},
	{
		label: "Oldest updated",
		value: formatInternalSortValue("updatedAt", "asc"),
	},
	{
		label: "Session id A-Z",
		value: formatInternalSortValue("sessionId", "asc"),
	},
];

export const Route = createFileRoute("/_chrome/internal/ai-sessions")({
	validateSearch: validateInternalAiSessionSearch,
	component: InternalAiSessionsRoute,
});

function InternalAiSessionsRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const search = Route.useSearch();
	const sessionsQuery = useQuery(getInternalAiSessionsQuery(search));

	if (pathname !== "/internal/ai-sessions") {
		return <Outlet />;
	}

	return (
		<InternalResourceLayout
			badges={
				<>
					<StatusPill tone="accent">Live shopper sessions</StatusPill>
					<StatusPill tone="neutral">{`${sessionsQuery.data?.records.length ?? 0} rows`}</StatusPill>
				</>
			}
			description="Storefront shopper sessions with dedicated session routes. Search is session-id driven and detail pages stay reactive to incoming thread updates."
			title="AI sessions"
		>
			<InternalResourceToolbar
				onPageSizeChange={(limit) => {
					void navigate({
						search: (current) => resetInternalPagination(current, { limit }),
					});
				}}
				onSearchChange={(q) => {
					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: "asc",
								q: q || undefined,
								sort: (q ? "sessionId" : current.sort) as InternalAiSessionSort,
							}),
					});
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalAiSessionSort>(value, {
						direction: "desc",
						sort: "updatedAt",
					});

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								q: next.sort === "sessionId" ? current.q : undefined,
								sort: next.sort,
							}),
					});
				}}
				pageSize={search.limit}
				pageSizeOptions={INTERNAL_PAGE_SIZE_OPTIONS}
				searchPlaceholder="Search by session id or thread id"
				searchValue={search.q}
				sortOptions={aiSessionSortOptions}
				sortValue={formatInternalSortValue(search.sort, search.dir)}
			/>

			{sessionsQuery.isPending ? (
				<Text>Loading AI sessions…</Text>
			) : sessionsQuery.isError || !sessionsQuery.data ? (
				<Text className="text-red-600 dark:text-red-500">Failed to load AI sessions.</Text>
			) : (
				<InternalResourceTable
					columns={aiSessionColumns}
					emptyBody="No storefront sessions matched the current filters."
					emptyTitle="No sessions"
					getRowHref={(row) => buildInternalHref(`/internal/ai-sessions/${row.id}`, search)}
					getRowKey={(row) => row.id}
					getRowLabel={(row) => row.sessionId}
					onNext={
						sessionsQuery.data.pageInfo.continueCursor
							? () => {
									void navigate({
										search: (current) =>
											advanceInternalPage(
												current,
												sessionsQuery.data?.pageInfo.continueCursor ?? null,
											),
									});
								}
							: null
					}
					onPrevious={
						search.prev
							? () => {
									void navigate({
										search: (current) => rewindInternalPage(current),
									});
								}
							: null
					}
					pageInfo={sessionsQuery.data.pageInfo}
					rows={sessionsQuery.data.records}
				/>
			)}
		</InternalResourceLayout>
	);
}
