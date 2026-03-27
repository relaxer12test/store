import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/cata/button";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Subheading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";
import { EmptyState } from "@/components/ui/feedback";
import {
	InternalCodeValue,
	InternalStatusValue,
	formatInternalTimestamp,
} from "@/components/ui/resource";
import { InternalDetailCard } from "@/components/ui/resource";
import { getInternalUserDetailQuery } from "@/features/internal/internal-admin-queries";
import { authClient } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";
import { invalidateAuthQueries } from "@/lib/auth-queries";

export const Route = createFileRoute("/_chrome/internal/users/$userId")({
	component: InternalUserDetailRoute,
});

function InternalUserDetailRoute() {
	const { userId } = Route.useParams();
	const queryClient = useQueryClient();
	const detailQuery = useQuery(getInternalUserDetailQuery(userId));
	const setRoleMutation = useMutation({
		mutationFn: async (role: "admin" | "user") => {
			const result = await authClient.admin.setRole({
				role,
				userId,
			});

			if (result.error) {
				throw new Error(getAuthClientErrorMessage(result.error, "Failed to update the user role."));
			}
		},
		onSuccess: async () => {
			await queryClient.invalidateQueries();
			await invalidateAuthQueries(queryClient);
		},
	});

	if (detailQuery.isPending) {
		return <Text>Loading user detail…</Text>;
	}

	if (detailQuery.isError || !detailQuery.data) {
		return (
			<InternalDetailCard title="User detail unavailable">
				<EmptyState body="The selected Better Auth user could not be loaded." title="Unavailable" />
			</InternalDetailCard>
		);
	}

	const { user } = detailQuery.data;
	const nextRole = user.role === "admin" ? "user" : "admin";

	return (
		<InternalDetailCard title={user.name}>
			<div className="flex flex-wrap items-center gap-2">
				<InternalStatusValue value={user.role ?? "user"} />
				<InternalStatusValue value={user.banned ? "banned" : "active"} />
			</div>

			<DescriptionList>
				<DescriptionTerm>Email</DescriptionTerm>
				<DescriptionDetails>{user.email}</DescriptionDetails>
				<DescriptionTerm>User id</DescriptionTerm>
				<DescriptionDetails>
					<InternalCodeValue value={user.id} />
				</DescriptionDetails>
				<DescriptionTerm>Created</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(user.createdAt)}</DescriptionDetails>
				<DescriptionTerm>Updated</DescriptionTerm>
				<DescriptionDetails>{formatInternalTimestamp(user.updatedAt)}</DescriptionDetails>
				<DescriptionTerm>Active org</DescriptionTerm>
				<DescriptionDetails>
					<InternalCodeValue value={user.activeOrganizationId} />
				</DescriptionDetails>
				<DescriptionTerm>Recent sessions</DescriptionTerm>
				<DescriptionDetails>{String(user.sessionCount)}</DescriptionDetails>
			</DescriptionList>

			<div className="flex flex-wrap items-center gap-3">
				<Button
					color="dark/zinc"
					disabled={setRoleMutation.isPending}
					onClick={() => setRoleMutation.mutate(nextRole)}
				>
					{setRoleMutation.isPending
						? "Updating role..."
						: nextRole === "admin"
							? "Make admin"
							: "Revoke admin"}
				</Button>
				{setRoleMutation.error ? (
					<Text className="text-red-600 dark:text-red-400">{setRoleMutation.error.message}</Text>
				) : null}
			</div>

			<section className="rounded-[1.6rem] border border-zinc-950/6 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800">
				<Subheading>Memberships</Subheading>
				{user.memberships.length === 0 ? (
					<Text className="mt-3">No Better Auth memberships were found for this user.</Text>
				) : (
					<ul className="mt-3 space-y-3">
						{user.memberships.map((membership) => (
							<li
								className="rounded-2xl border border-zinc-950/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
								key={membership.memberId}
							>
								<div className="flex flex-wrap items-center gap-2">
									<InternalStatusValue value={membership.role ?? "member"} />
								</div>
								<Text className="mt-2">{membership.shopDomain ?? "No linked shop"}</Text>
								<InternalCodeValue value={membership.organizationId} />
							</li>
						))}
					</ul>
				)}
			</section>

			<section className="rounded-[1.6rem] border border-zinc-950/6 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800">
				<Subheading>Recent sessions</Subheading>
				{user.recentSessions.length === 0 ? (
					<Text className="mt-3">No recent sessions were found for this user.</Text>
				) : (
					<ul className="mt-3 space-y-3">
						{user.recentSessions.map((session) => (
							<li
								className="rounded-2xl border border-zinc-950/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
								key={session.id}
							>
								<Text>{formatInternalTimestamp(session.updatedAt)}</Text>
								<InternalCodeValue value={session.id} />
							</li>
						))}
					</ul>
				)}
			</section>
		</InternalDetailCard>
	);
}
