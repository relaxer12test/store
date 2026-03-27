import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Select } from "@/components/ui/cata/select";
import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import {
	CodeValue,
	formatTimestampLabel,
	ResourcePageLayout,
	ResourceTable,
	ResourceToolbar,
	StatusValue,
	type ResourceTableColumn,
} from "@/components/ui/resource";
import { getInternalShopsQuery } from "@/features/internal/internal-admin-queries";
import { type InternalShopsSort } from "@/features/internal/internal-admin-route-state";
import {
	advanceInternalPage,
	buildInternalHref,
	formatInternalSortValue,
	parseInternalSortValue,
	resetInternalPagination,
	rewindInternalPage,
} from "@/features/internal/internal-admin-routing";
import { INTERNAL_PAGE_SIZE_OPTIONS } from "@/features/internal/internal-admin-search";
import { Route as ParentRoute } from "@/routes/_app.internal.shops";
import type { InternalShopSummary } from "@/shared/contracts/internal-admin";

const shopColumns: ResourceTableColumn<InternalShopSummary>[] = [
	{
		cell: (row) => (
			<div className="min-w-0">
				<Text className="font-semibold text-zinc-950 dark:text-white">{row.name}</Text>
				<CodeValue value={row.domain} />
			</div>
		),
		header: "Shop",
	},
	{
		cell: (row) => <StatusValue value={row.installStatus} />,
		header: "Install",
	},
	{
		cell: (row) => <StatusValue value={row.tokenStatus} />,
		header: "Token",
	},
	{
		cell: (row) => (
			<div className="space-y-1">
				<Text>{formatTimestampLabel(row.lastAuthenticatedAt)}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">
					created {formatTimestampLabel(row.createdAt)}
				</Text>
			</div>
		),
		header: "Activity",
	},
];

const shopSortOptions: Array<{ label: string; value: string }> = [
	{
		label: "Newest activity",
		value: formatInternalSortValue("createdAt", "desc"),
	},
	{
		label: "Oldest activity",
		value: formatInternalSortValue("createdAt", "asc"),
	},
	{
		label: "Domain A-Z",
		value: formatInternalSortValue("domain", "asc"),
	},
];

export const Route = createFileRoute("/_app/internal/shops/")({
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await context.preload.ensureQueryData(getInternalShopsQuery(deps));
	},
	component: InternalShopsIndexRoute,
});

function InternalShopsIndexRoute() {
	const navigate = useNavigate({
		from: ParentRoute.fullPath,
	});
	const search = ParentRoute.useSearch();
	const { data } = useSuspenseQuery(getInternalShopsQuery(search));

	return (
		<ResourcePageLayout
			badges={
				<>
					<StatusPill tone="accent">Install posture</StatusPill>
					<StatusPill tone="neutral">{`${data.records.length} rows`}</StatusPill>
				</>
			}
			description="Connected shops, install state, and offline-token posture. Search is domain-first, while status stays as an indexed filter."
			title="Shops"
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
								sort: (q ? "domain" : current.sort) as InternalShopsSort,
								status: q ? undefined : current.status,
							}),
					});
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalShopsSort>(value, {
						direction: "desc",
						sort: "createdAt",
					});

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								q: next.sort === "domain" ? current.q : undefined,
								sort: next.sort,
							}),
					});
				}}
				pageSize={search.limit}
				pageSizeOptions={INTERNAL_PAGE_SIZE_OPTIONS}
				searchPlaceholder="Search by domain"
				searchValue={search.q}
				sortOptions={shopSortOptions}
				sortValue={formatInternalSortValue(search.sort, search.dir)}
			>
				<Select
					onChange={(event) => {
						void navigate({
							search: (current) =>
								resetInternalPagination(current, {
									q: undefined,
									status:
										(event.target.value as "connected" | "inactive" | "pending" | "") || undefined,
								}),
						});
					}}
					value={search.status ?? ""}
				>
					<option value="">All install states</option>
					<option value="connected">Connected</option>
					<option value="inactive">Inactive</option>
					<option value="pending">Pending</option>
				</Select>
			</ResourceToolbar>

			<ResourceTable
				columns={shopColumns}
				emptyBody="No shops matched the current filters."
				emptyTitle="No shops"
				getRowHref={(row) => buildInternalHref(`/internal/shops/${row.id}`, search)}
				getRowKey={(row) => row.id}
				getRowLabel={(row) => row.domain}
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
