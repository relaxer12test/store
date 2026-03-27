import { useQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Select } from "@/components/ui/cata/select";
import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import { InternalStatusValue, formatInternalTimestamp } from "@/components/ui/resource";
import { InternalResourceLayout } from "@/components/ui/resource";
import {
	InternalResourceTable,
	InternalResourceToolbar,
	type InternalTableColumn,
} from "@/components/ui/resource";
import { getInternalCacheStatesQuery } from "@/features/internal/internal-admin-queries";
import {
	type InternalCacheSort,
	validateInternalCacheSearch,
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
import type { InternalCacheStateSummary } from "@/shared/contracts/internal-admin";

const cacheColumns: InternalTableColumn<InternalCacheStateSummary>[] = [
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
		cell: (row) => <InternalStatusValue value={row.status} />,
		header: "Status",
	},
	{
		cell: (row) => <Text>{String(row.recordCount)}</Text>,
		header: "Rows",
	},
	{
		cell: (row) => (
			<div className="space-y-1">
				<Text>{formatInternalTimestamp(row.updatedAt)}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">
					webhook {formatInternalTimestamp(row.lastWebhookAt)}
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

export const Route = createFileRoute("/_app/internal/cache")({
	validateSearch: validateInternalCacheSearch,
	component: InternalCacheRoute,
});

function InternalCacheRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	})
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})
	const search = Route.useSearch();
	const cacheQuery = useQuery(getInternalCacheStatesQuery(search));

	if (pathname !== "/internal/cache") {
		return <Outlet />;
	}

	return (
		<InternalResourceLayout
			badges={
				<>
					<StatusPill tone="accent">Projection freshness</StatusPill>
					<StatusPill tone="neutral">{`${cacheQuery.data?.records.length ?? 0} rows`}</StatusPill>
				</>
			}
			description="Cache state rows for Shopify-backed projections. Search is cache-key driven, while status filtering stays index-backed."
			title="Cache"
		>
			<InternalResourceToolbar
				onPageSizeChange={(limit) => {
					void navigate({
						search: (current) => resetInternalPagination(current, { limit }),
					})
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
					})
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalCacheSort>(value, {
						direction: "desc",
						sort: "updatedAt",
					})

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								q: next.sort === "cacheKey" ? current.q : undefined,
								sort: next.sort,
							}),
					})
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
						})
					}}
					value={search.status ?? ""}
				>
					<option value="">All statuses</option>
					<option value="ready">Ready</option>
					<option value="pending">Pending</option>
					<option value="failed">Failed</option>
					<option value="disabled">Disabled</option>
				</Select>
			</InternalResourceToolbar>

			{cacheQuery.isPending ? (
				<Text>Loading cache rows…</Text>
			) : cacheQuery.isError || !cacheQuery.data ? (
				<Text className="text-red-600 dark:text-red-500">Failed to load cache rows.</Text>
			) : (
				<InternalResourceTable
					columns={cacheColumns}
					emptyBody="No cache rows matched the current filters."
					emptyTitle="No cache rows"
					getRowHref={(row) => buildInternalHref(`/internal/cache/${row.id}`, search)}
					getRowKey={(row) => row.id}
					getRowLabel={(row) => row.cacheKey}
					onNext={
						cacheQuery.data.pageInfo.continueCursor
							? () => {
									void navigate({
										search: (current) =>
											advanceInternalPage(
												current,
												cacheQuery.data?.pageInfo.continueCursor ?? null,
											),
									})
								}
							: null
					}
					onPrevious={
						search.prev
							? () => {
									void navigate({
										search: (current) => rewindInternalPage(current),
									})
								}
							: null
					}
					pageInfo={cacheQuery.data.pageInfo}
					rows={cacheQuery.data.records}
				/>
			)}
		</InternalResourceLayout>
	)
}
