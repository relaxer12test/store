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
import { getInternalWebhookDeliveriesQuery } from "@/features/internal/internal-admin-queries";
import {
	type InternalWebhookSort,
	validateInternalWebhookSearch,
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
import type { InternalWebhookDeliverySummary } from "@/shared/contracts/internal-admin";

const webhookColumns: InternalTableColumn<InternalWebhookDeliverySummary>[] = [
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
		cell: (row) => <InternalStatusValue value={row.status} />,
		header: "Status",
	},
	{
		cell: (row) => <Text>{row.deliveryKey ?? "n/a"}</Text>,
		header: "Delivery key",
	},
	{
		cell: (row) => (
			<div className="space-y-1">
				<Text>{formatInternalTimestamp(row.receivedAt)}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">
					processed {formatInternalTimestamp(row.processedAt)}
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

export const Route = createFileRoute("/_app/internal/webhooks")({
	validateSearch: validateInternalWebhookSearch,
	component: InternalWebhooksRoute,
});

function InternalWebhooksRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	})
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})
	const search = Route.useSearch();
	const webhooksQuery = useQuery(getInternalWebhookDeliveriesQuery(search));

	if (pathname !== "/internal/webhooks") {
		return <Outlet />;
	}

	return (
		<InternalResourceLayout
			badges={
				<>
					<StatusPill tone="accent">Inbound events</StatusPill>
					<StatusPill tone="neutral">{`${webhooksQuery.data?.records.length ?? 0} rows`}</StatusPill>
				</>
			}
			description="Inbound Shopify webhook deliveries with stored payload previews. Search is topic-driven, while delivery state remains filterable."
			title="Webhooks"
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
								sort: (q ? "topic" : current.sort) as InternalWebhookSort,
								status: q ? undefined : current.status,
							}),
					})
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalWebhookSort>(value, {
						direction: "desc",
						sort: "receivedAt",
					})

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								q: next.sort === "topic" ? current.q : undefined,
								sort: next.sort,
							}),
					})
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
						})
					}}
					value={search.status ?? ""}
				>
					<option value="">All statuses</option>
					<option value="received">Received</option>
					<option value="processed">Processed</option>
					<option value="failed">Failed</option>
				</Select>
			</InternalResourceToolbar>

			{webhooksQuery.isPending ? (
				<Text>Loading webhook deliveries…</Text>
			) : webhooksQuery.isError || !webhooksQuery.data ? (
				<Text className="text-red-600 dark:text-red-500">Failed to load webhook deliveries.</Text>
			) : (
				<InternalResourceTable
					columns={webhookColumns}
					emptyBody="No webhook deliveries matched the current filters."
					emptyTitle="No webhook deliveries"
					getRowHref={(row) => buildInternalHref(`/internal/webhooks/${row.id}`, search)}
					getRowKey={(row) => row.id}
					getRowLabel={(row) => row.topic}
					onNext={
						webhooksQuery.data.pageInfo.continueCursor
							? () => {
									void navigate({
										search: (current) =>
											advanceInternalPage(
												current,
												webhooksQuery.data?.pageInfo.continueCursor ?? null,
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
					pageInfo={webhooksQuery.data.pageInfo}
					rows={webhooksQuery.data.records}
				/>
			)}
		</InternalResourceLayout>
	)
}
