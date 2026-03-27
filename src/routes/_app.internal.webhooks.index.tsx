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
import { getInternalWebhookDeliveriesQuery } from "@/features/internal/internal-admin-queries";
import { type InternalWebhookSort } from "@/features/internal/internal-admin-route-state";
import {
	advanceInternalPage,
	buildInternalHref,
	formatInternalSortValue,
	parseInternalSortValue,
	resetInternalPagination,
	rewindInternalPage,
} from "@/features/internal/internal-admin-routing";
import { INTERNAL_PAGE_SIZE_OPTIONS } from "@/features/internal/internal-admin-search";
import { Route as ParentRoute } from "@/routes/_app.internal.webhooks";
import type { InternalWebhookDeliverySummary } from "@/shared/contracts/internal-admin";

const webhookColumns: ResourceTableColumn<InternalWebhookDeliverySummary>[] = [
	{
		cell: (row) => (
			<div>
				<Text className="font-semibold text-zinc-950 dark:text-white">{row.topic}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">{row.domain}</Text>
			</div>
		),
		header: "Topic",
	},
	{
		cell: (row) => <StatusValue value={row.status} />,
		header: "Status",
	},
	{
		cell: (row) => <Text>{row.deliveryKey ?? "n/a"}</Text>,
		header: "Delivery key",
	},
	{
		cell: (row) => (
			<div className="space-y-1">
				<Text>{formatTimestampLabel(row.receivedAt)}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">
					processed {formatTimestampLabel(row.processedAt)}
				</Text>
			</div>
		),
		header: "Received",
	},
];

const webhookSortOptions = [
	{
		label: "Latest received",
		value: formatInternalSortValue("receivedAt", "desc"),
	},
	{
		label: "Oldest received",
		value: formatInternalSortValue("receivedAt", "asc"),
	},
	{
		label: "Topic A-Z",
		value: formatInternalSortValue("topic", "asc"),
	},
];

export const Route = createFileRoute("/_app/internal/webhooks/")({
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await context.preload.ensureQueryData(getInternalWebhookDeliveriesQuery(deps));
	},
	component: InternalWebhooksIndexRoute,
});

function InternalWebhooksIndexRoute() {
	const navigate = useNavigate({
		from: ParentRoute.fullPath,
	});
	const search = ParentRoute.useSearch();
	const { data } = useSuspenseQuery(getInternalWebhookDeliveriesQuery(search));

	return (
		<ResourcePageLayout
			badges={
				<>
					<StatusPill tone="accent">Inbound events</StatusPill>
					<StatusPill tone="neutral">{`${data.records.length} rows`}</StatusPill>
				</>
			}
			description="Inbound Shopify webhook deliveries with stored payload previews. Search is topic-driven, while delivery state remains filterable."
			title="Webhooks"
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
								sort: (q ? "topic" : current.sort) as InternalWebhookSort,
								status: q ? undefined : current.status,
							}),
					});
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalWebhookSort>(value, {
						direction: "desc",
						sort: "receivedAt",
					});

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								q: next.sort === "topic" ? current.q : undefined,
								sort: next.sort,
							}),
					});
				}}
				pageSize={search.limit}
				pageSizeOptions={INTERNAL_PAGE_SIZE_OPTIONS}
				searchPlaceholder="Search by topic"
				searchValue={search.q}
				sortOptions={webhookSortOptions}
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
					<option value="received">Received</option>
					<option value="processed">Processed</option>
					<option value="failed">Failed</option>
				</Select>
			</ResourceToolbar>

			<ResourceTable
				columns={webhookColumns}
				emptyBody="No webhook deliveries matched the current filters."
				emptyTitle="No webhook deliveries"
				getRowHref={(row) => buildInternalHref(`/internal/webhooks/${row.id}`, search)}
				getRowKey={(row) => row.id}
				getRowLabel={(row) => row.topic}
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
