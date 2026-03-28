import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import {
	CodeValue,
	formatTimestampLabel,
	ResourceTable,
	ResourceToolbar,
	StatusValue,
	type ResourceTableColumn,
} from "@/components/ui/resource";
import { getInternalAiSessionsQuery } from "@/features/internal/internal-admin-queries";
import { type InternalAiSessionSort } from "@/features/internal/internal-admin-route-state";
import {
	advanceInternalPage,
	buildInternalHref,
	formatInternalSortValue,
	parseInternalSortValue,
	resetInternalPagination,
	rewindInternalPage,
} from "@/features/internal/internal-admin-routing";
import { INTERNAL_PAGE_SIZE_OPTIONS } from "@/features/internal/internal-admin-search";
import { Route as ParentRoute } from "@/routes/_app.internal.ai-sessions";
import type { InternalAiSessionSummary } from "@/shared/contracts/internal-admin";

const aiSessionColumns: ResourceTableColumn<InternalAiSessionSummary>[] = [
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
				<CodeValue value={row.sessionId} />
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">{row.threadId}</Text>
			</div>
		),
		header: "Session",
	},
	{
		cell: (row) => <StatusValue value={row.lastReplyTone ?? "no reply"} />,
		header: "Reply",
	},
	{
		cell: (row) => (
			<div className="space-y-1">
				<Text>{row.lastPromptPreview ?? "No prompt preview"}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">
					updated {formatTimestampLabel(row.updatedAt)}
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

export const Route = createFileRoute("/_app/internal/ai-sessions/")({
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await context.preload.ensureQueryData(getInternalAiSessionsQuery(deps));
	},
	component: InternalAiSessionsIndexRoute,
});

function InternalAiSessionsIndexRoute() {
	const navigate = useNavigate({
		from: ParentRoute.fullPath,
	});
	const search = ParentRoute.useSearch();
	const { data } = useSuspenseQuery(getInternalAiSessionsQuery(search));

	return (
		<div className="grid gap-3">
			<ResourceToolbar
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

			<ResourceTable
				columns={aiSessionColumns}
				emptyBody="No storefront sessions matched the current filters."
				emptyTitle="No sessions"
				getRowHref={(row) => buildInternalHref(`/internal/ai-sessions/${row.id}`, search)}
				getRowKey={(row) => row.id}
				getRowLabel={(row) => row.sessionId}
				onNext={
					data.pageInfo.continueCursor
						? () => {
								void navigate({
									search: (current) => advanceInternalPage(current, data.pageInfo.continueCursor),
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
				pageInfo={data.pageInfo}
				rows={data.records}
			/>
		</div>
	);
}
