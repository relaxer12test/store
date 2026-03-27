import { useQuery } from "@tanstack/react-query";
import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import { InternalStatusValue, formatInternalTimestamp } from "@/components/ui/resource";
import { InternalResourceLayout } from "@/components/ui/resource";
import {
	InternalResourceTable,
	InternalResourceToolbar,
	type InternalTableColumn,
} from "@/components/ui/resource";
import { getInternalAuditsQuery } from "@/features/internal/internal-admin-queries";
import {
	type InternalAuditSort,
	validateInternalAuditSearch,
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
import type { InternalAuditSummary } from "@/shared/contracts/internal-admin";

const auditColumns: InternalTableColumn<InternalAuditSummary>[] = [
	{
		cell: (row) => (
			<div>
				<Text className="font-semibold text-zinc-950 dark:text-white">{row.action}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">
					{row.detail ?? "No detail"}
				</Text>
			</div>
		),
		header: "Action",
	},
	{
		cell: (row) => <InternalStatusValue value={row.status} />,
		header: "Status",
	},
	{
		cell: (row) => <Text>{row.actorId ?? "system"}</Text>,
		header: "Actor",
	},
	{
		cell: (row) => <Text>{formatInternalTimestamp(row.createdAt)}</Text>,
		header: "Created",
	},
];

const auditSortOptions = [
	{
		label: "Latest created",
		value: formatInternalSortValue("createdAt", "desc"),
	},
	{
		label: "Oldest created",
		value: formatInternalSortValue("createdAt", "asc"),
	},
	{
		label: "Action A-Z",
		value: formatInternalSortValue("action", "asc"),
	},
];

export const Route = createFileRoute("/_app/internal/audits")({
	validateSearch: validateInternalAuditSearch,
	component: InternalAuditsRoute,
});

function InternalAuditsRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	})
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})
	const search = Route.useSearch();
	const auditsQuery = useQuery(getInternalAuditsQuery(search));

	if (pathname !== "/internal/audits") {
		return <Outlet />;
	}

	return (
		<InternalResourceLayout
			badges={
				<>
					<StatusPill tone="accent">Audit trail</StatusPill>
					<StatusPill tone="neutral">{`${auditsQuery.data?.records.length ?? 0} rows`}</StatusPill>
				</>
			}
			description="Recorded audit entries and approval-adjacent side effects. Search is action-driven and the detail pane exposes stored payload metadata."
			title="Audits"
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
								sort: (q ? "action" : current.sort) as InternalAuditSort,
							}),
					})
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalAuditSort>(value, {
						direction: "desc",
						sort: "createdAt",
					})

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								q: next.sort === "action" ? current.q : undefined,
								sort: next.sort,
							}),
					})
				}}
				pageSize={search.limit}
				pageSizeOptions={INTERNAL_PAGE_SIZE_OPTIONS}
				searchPlaceholder="Search by action"
				searchValue={search.q}
				sortOptions={auditSortOptions}
				sortValue={formatInternalSortValue(search.sort, search.dir)}
			/>

			{auditsQuery.isPending ? (
				<Text>Loading audits…</Text>
			) : auditsQuery.isError || !auditsQuery.data ? (
				<Text className="text-red-600 dark:text-red-500">Failed to load audits.</Text>
			) : (
				<InternalResourceTable
					columns={auditColumns}
					emptyBody="No audit rows matched the current filters."
					emptyTitle="No audit rows"
					getRowHref={(row) => buildInternalHref(`/internal/audits/${row.id}`, search)}
					getRowKey={(row) => row.id}
					getRowLabel={(row) => row.action}
					onNext={
						auditsQuery.data.pageInfo.continueCursor
							? () => {
									void navigate({
										search: (current) =>
											advanceInternalPage(
												current,
												auditsQuery.data?.pageInfo.continueCursor ?? null,
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
					pageInfo={auditsQuery.data.pageInfo}
					rows={auditsQuery.data.records}
				/>
			)}
		</InternalResourceLayout>
	)
}
