import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Select } from "@/components/ui/cata/select";
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
import { getInternalWorkflowsQuery } from "@/features/internal/internal-admin-queries";
import { type InternalWorkflowSort } from "@/features/internal/internal-admin-route-state";
import {
	advanceInternalPage,
	buildInternalHref,
	formatInternalSortValue,
	parseInternalSortValue,
	resetInternalPagination,
	rewindInternalPage,
} from "@/features/internal/internal-admin-routing";
import { INTERNAL_PAGE_SIZE_OPTIONS } from "@/features/internal/internal-admin-search";
import { Route as ParentRoute } from "@/routes/_app.internal.workflows";
import type { InternalWorkflowSummary } from "@/shared/contracts/internal-admin";

const workflowColumns: ResourceTableColumn<InternalWorkflowSummary>[] = [
	{
		cell: (row) => (
			<div>
				<Text className="font-semibold text-zinc-950 dark:text-white">{row.type}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">{row.domain}</Text>
			</div>
		),
		header: "Workflow",
	},
	{
		cell: (row) => <StatusValue value={row.status} />,
		header: "Status",
	},
	{
		cell: (row) => <Text>{row.retryCount > 0 ? `retry ${row.retryCount}` : "first run"}</Text>,
		header: "Retry",
	},
	{
		cell: (row) => (
			<div className="space-y-1">
				<Text>{formatTimestampLabel(row.lastUpdatedAt)}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">
					{row.payloadPreview ?? "No payload preview"}
				</Text>
			</div>
		),
		header: "Last updated",
	},
];

const workflowSortOptions = [
	{
		label: "Latest updated",
		value: formatInternalSortValue("lastUpdatedAt", "desc"),
	},
	{
		label: "Oldest updated",
		value: formatInternalSortValue("lastUpdatedAt", "asc"),
	},
	{
		label: "Workflow type A-Z",
		value: formatInternalSortValue("type", "asc"),
	},
];

export const Route = createFileRoute("/_app/internal/workflows/")({
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await context.preload.ensureQueryData(getInternalWorkflowsQuery(deps));
	},
	component: InternalWorkflowsIndexRoute,
});

function InternalWorkflowsIndexRoute() {
	const navigate = useNavigate({
		from: ParentRoute.fullPath,
	});
	const search = ParentRoute.useSearch();
	const { data } = useSuspenseQuery(getInternalWorkflowsQuery(search));

	return (
		<ResourcePageLayout
			badges={
				<>
					<StatusPill tone="accent">Queue status</StatusPill>
					<StatusPill tone="neutral">{`${data.records.length} workflows`}</StatusPill>
				</>
			}
			description="Background workflows, retries, and recent activity."
			title="Workflows"
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
								sort: (q ? "type" : current.sort) as InternalWorkflowSort,
								status: q ? undefined : current.status,
							}),
					});
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalWorkflowSort>(value, {
						direction: "desc",
						sort: "lastUpdatedAt",
					});

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								q: next.sort === "type" ? current.q : undefined,
								sort: next.sort,
							}),
					});
				}}
				pageSize={search.limit}
				pageSizeOptions={INTERNAL_PAGE_SIZE_OPTIONS}
				searchPlaceholder="Search by workflow type"
				searchValue={search.q}
				sortOptions={workflowSortOptions}
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
					<option value="pending">Pending</option>
					<option value="running">Running</option>
					<option value="completed">Completed</option>
					<option value="failed">Failed</option>
				</Select>
			</ResourceToolbar>

			<ResourceTable
				columns={workflowColumns}
				emptyBody="No workflows matched the current filters."
				emptyTitle="No workflows"
				getRowHref={(row) => buildInternalHref(`/internal/workflows/${row.id}`, search)}
				getRowKey={(row) => row.id}
				getRowLabel={(row) => row.type}
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
