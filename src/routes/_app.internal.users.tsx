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
import { getInternalUsersQuery } from "@/features/internal/internal-admin-queries";
import {
	type InternalUsersSort,
	validateInternalUsersSearch,
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
import type { InternalUserSummary } from "@/shared/contracts/internal-admin";

const userColumns: InternalTableColumn<InternalUserSummary>[] = [
	{
		cell: (row) => (
			<div>
				<Text className="font-semibold text-zinc-950 dark:text-white">{row.name}</Text>
				<Text className="text-xs text-zinc-500 dark:text-zinc-400">{row.email}</Text>
			</div>
		),
		header: "User",
	},
	{
		cell: (row) => <InternalStatusValue value={row.role ?? "user"} />,
		header: "Role",
	},
	{
		cell: (row) => <InternalStatusValue value={row.banned ? "banned" : "active"} />,
		header: "State",
	},
	{
		cell: (row) => <Text>{formatInternalTimestamp(row.createdAt)}</Text>,
		header: "Created",
	},
];

const userSortOptions = [
	{
		label: "Name A-Z",
		value: formatInternalSortValue("name", "asc"),
	},
	{
		label: "Name Z-A",
		value: formatInternalSortValue("name", "desc"),
	},
	{
		label: "Newest created",
		value: formatInternalSortValue("createdAt", "desc"),
	},
];

export const Route = createFileRoute("/_app/internal/users")({
	validateSearch: validateInternalUsersSearch,
	component: InternalUsersRoute,
});

function InternalUsersRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	})
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	})
	const search = Route.useSearch();
	const usersQuery = useQuery(getInternalUsersQuery(search));

	if (pathname !== "/internal/users") {
		return <Outlet />;
	}

	return (
		<InternalResourceLayout
			badges={
				<>
					<StatusPill tone="accent">Better Auth</StatusPill>
					<StatusPill tone="neutral">{`${usersQuery.data?.records.length ?? 0} rows`}</StatusPill>
				</>
			}
			description="Better Auth users with role, membership, and recent-session drill-in. Search is name/email driven; role filtering stays explicit."
			title="Users"
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
								q: q || undefined,
								role: q ? undefined : current.role,
							}),
					})
				}}
				onSortChange={(value) => {
					const next = parseInternalSortValue<InternalUsersSort>(value, {
						direction: "asc",
						sort: "name",
					})

					void navigate({
						search: (current) =>
							resetInternalPagination(current, {
								dir: next.direction,
								sort: next.sort,
							}),
					})
				}}
				pageSize={search.limit}
				pageSizeOptions={INTERNAL_PAGE_SIZE_OPTIONS}
				searchPlaceholder="Search by name or email"
				searchValue={search.q}
				sortOptions={userSortOptions}
				sortValue={formatInternalSortValue(search.sort, search.dir)}
			>
				<Select
					onChange={(event) => {
						void navigate({
							search: (current) =>
								resetInternalPagination(current, {
									q: undefined,
									role: event.target.value || undefined,
								}),
						})
					}}
					value={search.role ?? ""}
				>
					<option value="">All roles</option>
					<option value="admin">Admin</option>
					<option value="user">User</option>
				</Select>
			</InternalResourceToolbar>

			{usersQuery.isPending ? (
				<Text>Loading users…</Text>
			) : usersQuery.isError || !usersQuery.data ? (
				<Text className="text-red-600 dark:text-red-500">Failed to load users.</Text>
			) : (
				<InternalResourceTable
					columns={userColumns}
					emptyBody="No users matched the current filters."
					emptyTitle="No users"
					getRowHref={(row) => buildInternalHref(`/internal/users/${row.id}`, search)}
					getRowKey={(row) => row.id}
					getRowLabel={(row) => row.email}
					onNext={
						usersQuery.data.pageInfo.continueCursor
							? () => {
									void navigate({
										search: (current) =>
											advanceInternalPage(
												current,
												usersQuery.data?.pageInfo.continueCursor ?? null,
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
					pageInfo={usersQuery.data.pageInfo}
					rows={usersQuery.data.records}
				/>
			)}
		</InternalResourceLayout>
	)
}
