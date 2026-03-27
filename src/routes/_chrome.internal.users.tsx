import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/cata/button";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Subheading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { authClient, useSessionEnvelope } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";

interface ManagedUser {
	banned?: boolean | null;
	createdAt?: Date | string | null;
	email: string;
	id: string;
	name: string;
	role?: string | null;
	updatedAt?: Date | string | null;
}

function formatTimestamp(value: Date | string | null | undefined) {
	if (!value) {
		return "n/a";
	}

	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export const Route = createFileRoute("/_chrome/internal/users")({
	component: InternalUsersRoute,
});

function InternalUsersRoute() {
	const session = useSessionEnvelope();
	const [users, setUsers] = useState<ManagedUser[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isPending, startTransition] = useTransition();

	const loadUsers = async () => {
		setError(null);
		setIsLoading(true);

		try {
			const result = await authClient.admin.listUsers({
				query: {
					limit: 100,
					sortBy: "name",
					sortDirection: "asc",
				},
			});

			if (result.error) {
				throw new Error(
					getAuthClientErrorMessage(result.error, "Failed to load Better Auth users."),
				);
			}

			const nextUsers = Array.isArray(result.data)
				? result.data
				: ((result.data?.users ?? []) as ManagedUser[]);

			setUsers(nextUsers);
		} catch (loadError) {
			setError(
				loadError instanceof Error ? loadError.message : "Failed to load Better Auth users.",
			);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		void loadUsers();
	}, []);

	const adminCount = users.filter((user) => user.role === "admin").length;

	return (
		<div className="grid gap-5">
			<Panel
				description="This surface uses native Better Auth admin APIs. The first merchant-authenticated user is promoted automatically, and role changes from here stay inside Better Auth."
				title="User management"
			>
				<div className="flex flex-wrap items-center gap-3">
					<StatusPill tone="accent">{`${adminCount} admin${adminCount === 1 ? "" : "s"}`}</StatusPill>
					<StatusPill tone="neutral">{`${users.length} total user${users.length === 1 ? "" : "s"}`}</StatusPill>
					<Button
						disabled={isLoading || isPending}
						outline
						onClick={() => {
							startTransition(() => {
								void loadUsers();
							});
						}}
					>
						{isLoading || isPending ? "Refreshing" : "Refresh"}
					</Button>
				</div>
				{error ? <Text className="mt-4 text-red-700">{error}</Text> : null}
			</Panel>

			<Panel
				description="Users are resolved directly from Better Auth. Merchant tenancy now lives in Better Auth organizations and members rather than a separate Convex actor table."
				title="Users"
			>
				{isLoading ? (
					<Text>Loading Better Auth users…</Text>
				) : users.length === 0 ? (
					<Text>No Better Auth users exist yet.</Text>
				) : (
					<div className="space-y-4">
						{users.map((user) => {
							const isCurrentUser = session.viewer?.email === user.email;
							const isLastAdmin = user.role === "admin" && adminCount === 1;
							const nextRole = user.role === "admin" ? "user" : "admin";

							return (
								<article
									className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800"
									key={user.id}
								>
									<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
										<div className="space-y-3">
											<div>
												<Subheading>{user.name}</Subheading>
												<Text>{user.email}</Text>
											</div>
											<div className="flex flex-wrap items-center gap-2">
												<StatusPill tone={user.role === "admin" ? "accent" : "neutral"}>
													{user.role ?? "user"}
												</StatusPill>
												{user.banned ? <StatusPill tone="blocked">Banned</StatusPill> : null}
												{isCurrentUser ? (
													<StatusPill tone="accent">Current session</StatusPill>
												) : null}
											</div>
											<DescriptionList>
												<DescriptionTerm>Better Auth user id</DescriptionTerm>
												<DescriptionDetails>{user.id}</DescriptionDetails>
												<DescriptionTerm>Created at</DescriptionTerm>
												<DescriptionDetails>{formatTimestamp(user.createdAt)}</DescriptionDetails>
												<DescriptionTerm>Updated at</DescriptionTerm>
												<DescriptionDetails>{formatTimestamp(user.updatedAt)}</DescriptionDetails>
											</DescriptionList>
										</div>

										<div className="flex flex-wrap items-center gap-3">
											<Button
												color="dark/zinc"
												disabled={isPending || isLastAdmin}
												onClick={() => {
													setError(null);
													startTransition(() => {
														void (async () => {
															try {
																const result = await authClient.admin.setRole({
																	role: nextRole,
																	userId: user.id,
																});

																if (result.error) {
																	throw new Error(
																		getAuthClientErrorMessage(
																			result.error,
																			"Failed to update the user role.",
																		),
																	);
																}

																await loadUsers();
															} catch (roleError) {
																setError(
																	roleError instanceof Error
																		? roleError.message
																		: "Failed to update the user role.",
																);
															}
														})();
													});
												}}
											>
												{user.role === "admin" ? "Revoke admin" : "Make admin"}
											</Button>
											{isLastAdmin ? (
												<Text>At least one admin must remain.</Text>
											) : null}
										</div>
									</div>
								</article>
							);
						})}
					</div>
				)}
			</Panel>
		</div>
	);
}
