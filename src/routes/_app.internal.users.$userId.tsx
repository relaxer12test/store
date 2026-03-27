import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/cata/button";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Text } from "@/components/ui/cata/text";
import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import {
	CodeValue,
	formatTimestampLabel,
	ResourceDetailCard,
	StatusValue,
} from "@/components/ui/resource";
import {
	getInternalUserDetailQuery,
	invalidateInternalUserQueries,
} from "@/features/internal/internal-admin-queries";
import { authClient } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";
import { invalidateAuthQueries } from "@/lib/auth-queries";

export const Route = createFileRoute("/_app/internal/users/$userId")({
	loader: async ({ context, params }) => {
		await context.preload.ensureQueryData(getInternalUserDetailQuery(params.userId));
	},
	component: InternalUserDetailRoute,
});

function InternalUserDetailRoute() {
	const { userId } = Route.useParams();
	const queryClient = useQueryClient();
	const { data } = useSuspenseQuery(getInternalUserDetailQuery(userId));
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
			await Promise.all([
				invalidateAuthQueries(queryClient),
				invalidateInternalUserQueries(queryClient, userId),
			]);
		},
	});

	if (!data) {
		return (
			<ResourceDetailCard title="User detail unavailable">
				<EmptyState body="The selected Better Auth user could not be loaded." title="Unavailable" />
			</ResourceDetailCard>
		);
	}

	const { user } = data;
	const nextRole = user.role === "admin" ? "user" : "admin";

	return (
		<ResourceDetailCard title={user.name}>
			<div className="flex flex-wrap items-center gap-2">
				<StatusValue value={user.role ?? "user"} />
				<StatusValue value={user.banned ? "banned" : "active"} />
			</div>

			<DescriptionList>
				<DescriptionTerm>Email</DescriptionTerm>
				<DescriptionDetails>{user.email}</DescriptionDetails>
				<DescriptionTerm>User id</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={user.id} />
				</DescriptionDetails>
				<DescriptionTerm>Created</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(user.createdAt)}</DescriptionDetails>
				<DescriptionTerm>Updated</DescriptionTerm>
				<DescriptionDetails>{formatTimestampLabel(user.updatedAt)}</DescriptionDetails>
				<DescriptionTerm>Active org</DescriptionTerm>
				<DescriptionDetails>
					<CodeValue value={user.activeOrganizationId} />
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

			<Panel title="Memberships">
				{user.memberships.length === 0 ? (
					<Text>No Better Auth memberships were found for this user.</Text>
				) : (
					<ul className="space-y-3">
						{user.memberships.map((membership) => (
							<li
								className="rounded-lg border border-zinc-950/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
								key={membership.memberId}
							>
								<div className="flex flex-wrap items-center gap-2">
									<StatusValue value={membership.role ?? "member"} />
								</div>
								<Text className="mt-2">{membership.shopDomain ?? "No linked shop"}</Text>
								<CodeValue value={membership.organizationId} />
							</li>
						))}
					</ul>
				)}
			</Panel>

			<Panel title="Recent sessions">
				{user.recentSessions.length === 0 ? (
					<Text>No recent sessions were found for this user.</Text>
				) : (
					<ul className="space-y-3">
						{user.recentSessions.map((session) => (
							<li
								className="rounded-lg border border-zinc-950/6 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900"
								key={session.id}
							>
								<Text>{formatTimestampLabel(session.updatedAt)}</Text>
								<CodeValue value={session.id} />
							</li>
						))}
					</ul>
				)}
			</Panel>
		</ResourceDetailCard>
	);
}
