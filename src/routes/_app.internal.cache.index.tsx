import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Select } from "@/components/ui/cata/select";
import { Text } from "@/components/ui/cata/text";
import {
	formatTimestampLabel,
	ResourceTable,
	ResourceToolbar,
	StatusValue,
	type ResourceTableColumn,
} from "@/components/ui/resource";
import { getInternalCacheStatesQuery } from "@/features/internal/internal-admin-queries";
import { type InternalCacheSort } from "@/features/internal/internal-admin-route-state";
import {
	advanceInternalPage,
	buildInternalHref,
	formatInternalSortValue,
	parseInternalSortValue,
	resetInternalPagination,
	rewindInternalPage,
} from "@/features/internal/internal-admin-routing";
import { INTERNAL_PAGE_SIZE_OPTIONS } from "@/features/internal/internal-admin-search";
import { Route as ParentRoute } from "@/routes/_app.internal.cache";
import type { InternalCacheStateSummary } from "@/shared/contracts/internal-admin";

const cacheColumns: ResourceTableColumn<InternalCacheStateSummary>[] = [
	{
		cell: (row) => (
			<div>
				<Text className="font-semibold text-zinc-950 dark:text-white">{row.cacheKey}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">{row.domain}</Text>
			</div>
		),
		header: "Cache key",
	},
	{
		cell: (row) => <StatusValue value={row.status} />,
		header: "Status",
	},
	{
		cell: (row) => <Text>{String(row.recordCount)}</Text>,
		header: "Rows",
	},
	{
		cell: (row) => (
			<div className="space-y-1">
				<Text>{formatTimestampLabel(row.updatedAt)}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">
					webhook {formatTimestampLabel(row.lastWebhookAt)}
				</Text>
			</div>
		),
		header: "Freshness",
	},
];

const cacheSortOptions = [
	{
		label: "Latest updated",
		value: formatInternalSortValue("updatedAt", "desc"),
	},
	{
		label: "Oldest updated",
		value: formatInternalSortValue("updatedAt", "asc"),
	},
	{
		label: "Cache key A-Z",
		value: formatInternalSortValue("cacheKey", "asc"),
	},
];

export const Route = createFileRoute("/_app/internal/cache/")({
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await context.preload.ensureQueryData(getInternalCacheStatesQuery(deps));
	},
	component: InternalCacheIndexRoute,
});

function InternalCacheIndexRoute() {
	const navigate = useNavigate({
		from: ParentRoute.fullPath,
	});
	const search = ParentRoute.useSearch();
	const { data } = useSuspenseQuery(getInternalCacheStatesQuery(search));

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
								sort: (q ? "cacheKey" : current.sort) as InternalCacheSort,
								status: q ? undefined : current.status,
							}),
					});
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalCacheSort>(value, {
						direction: "desc",
						sort: "updatedAt",
					});

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								q: next.sort === "cacheKey" ? current.q : undefined,
								sort: next.sort,
							}),
					});
				}}
				pageSize={search.limit}
				pageSizeOptions={INTERNAL_PAGE_SIZE_OPTIONS}
				searchPlaceholder="Search by cache key"
				searchValue={search.q}
				sortOptions={cacheSortOptions}
				sortValue={formatInternalSortValue(search.sort, search.dir)}
			>
				<Select
					onChange={(event) => {
						void navigate({
							search: (current) =>
								resetInternalPagination(current, {
									q: undefined,
									status: event.target.value || undefined,
								}),
						});
					}}
					value={search.status ?? ""}
				>
					<option value="">All statuses</option>
					<option value="ready">Ready</option>
					<option value="pending">Pending</option>
					<option value="failed">Failed</option>
					<option value="disabled">Disabled</option>
				</Select>
			</ResourceToolbar>

			<ResourceTable
				columns={cacheColumns}
				emptyBody="No cache rows matched the current filters."
				emptyTitle="No cache rows"
				getRowHref={(row) => buildInternalHref(`/internal/cache/${row.id}`, search)}
				getRowKey={(row) => row.id}
				getRowLabel={(row) => row.cacheKey}
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
