import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import {
	formatTimestampLabel,
	ResourcePageLayout,
	ResourceTable,
	ResourceToolbar,
	StatusValue,
	type ResourceTableColumn,
} from "@/components/ui/resource";
import { getInternalAuditsQuery } from "@/features/internal/internal-admin-queries";
import { type InternalAuditSort } from "@/features/internal/internal-admin-route-state";
import {
	advanceInternalPage,
	buildInternalHref,
	formatInternalSortValue,
	parseInternalSortValue,
	resetInternalPagination,
	rewindInternalPage,
} from "@/features/internal/internal-admin-routing";
import { INTERNAL_PAGE_SIZE_OPTIONS } from "@/features/internal/internal-admin-search";
import { Route as ParentRoute } from "@/routes/_app.internal.audits";
import type { InternalAuditSummary } from "@/shared/contracts/internal-admin";

const auditColumns: ResourceTableColumn<InternalAuditSummary>[] = [
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
		cell: (row) => <StatusValue value={row.status} />,
		header: "Status",
	},
	{
		cell: (row) => <Text>{row.actorId ?? "system"}</Text>,
		header: "Actor",
	},
	{
		cell: (row) => <Text>{formatTimestampLabel(row.createdAt)}</Text>,
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

export const Route = createFileRoute("/_app/internal/audits/")({
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await context.preload.ensureQueryData(getInternalAuditsQuery(deps));
	},
	component: InternalAuditsIndexRoute,
});

function InternalAuditsIndexRoute() {
	const navigate = useNavigate({
		from: ParentRoute.fullPath,
	});
	const search = ParentRoute.useSearch();
	const { data } = useSuspenseQuery(getInternalAuditsQuery(search));

	return (
		<ResourcePageLayout
			badges={
				<>
					<StatusPill tone="accent">Audit trail</StatusPill>
					<StatusPill tone="neutral">{`${data.records.length} rows`}</StatusPill>
				</>
			}
			description="Recorded audit entries and approval-adjacent side effects. Search is action-driven and the detail pane exposes stored payload metadata."
			title="Audits"
		>
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
								sort: (q ? "action" : current.sort) as InternalAuditSort,
							}),
					});
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalAuditSort>(value, {
						direction: "desc",
						sort: "createdAt",
					});

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								q: next.sort === "action" ? current.q : undefined,
								sort: next.sort,
							}),
					});
				}}
				pageSize={search.limit}
				pageSizeOptions={INTERNAL_PAGE_SIZE_OPTIONS}
				searchPlaceholder="Search by action"
				searchValue={search.q}
				sortOptions={auditSortOptions}
				sortValue={formatInternalSortValue(search.sort, search.dir)}
			/>

			<ResourceTable
				columns={auditColumns}
				emptyBody="No audit rows matched the current filters."
				emptyTitle="No audit rows"
				getRowHref={(row) => buildInternalHref(`/internal/audits/${row.id}`, search)}
				getRowKey={(row) => row.id}
				getRowLabel={(row) => row.action}
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
		</ResourcePageLayout>
	);
}
