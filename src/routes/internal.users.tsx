import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useTransition } from "react";
import { StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { authClient, useSessionEnvelope } from "@/lib/auth-client";

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

export const Route = createFileRoute("/internal/users")({
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
				throw new Error(result.error.message);
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
					<button
						className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
						disabled={isLoading || isPending}
						onClick={() => {
							startTransition(() => {
								void loadUsers();
							});
						}}
						type="button"
					>
						{isLoading || isPending ? "Refreshing" : "Refresh"}
					</button>
				</div>
				{error ? <p className="mt-4 text-sm leading-6 text-red-700">{error}</p> : null}
			</Panel>

			<Panel
				description="Users are resolved directly from Better Auth. Merchant tenancy now lives in Better Auth organizations and members rather than a separate Convex actor table."
				title="Users"
			>
				{isLoading ? (
					<p className="text-sm leading-6 text-slate-600">Loading Better Auth users…</p>
				) : users.length === 0 ? (
					<p className="text-sm leading-6 text-slate-600">No Better Auth users exist yet.</p>
				) : (
					<div className="space-y-4">
						{users.map((user) => {
							const isCurrentUser = session.viewer?.email === user.email;
							const isLastAdmin = user.role === "admin" && adminCount === 1;
							const nextRole = user.role === "admin" ? "user" : "admin";

							return (
								<article
									className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5"
									key={user.id}
								>
									<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
										<div className="space-y-3">
											<div>
												<h2 className="text-lg font-semibold text-slate-950">{user.name}</h2>
												<p className="text-sm leading-6 text-slate-600">{user.email}</p>
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
											<dl className="grid gap-2 text-sm leading-6 text-slate-600 sm:grid-cols-2">
												<div>
													<dt className="font-semibold text-slate-900">Better Auth user id</dt>
													<dd>{user.id}</dd>
												</div>
												<div>
													<dt className="font-semibold text-slate-900">Created at</dt>
													<dd>{formatTimestamp(user.createdAt)}</dd>
												</div>
												<div>
													<dt className="font-semibold text-slate-900">Updated at</dt>
													<dd>{formatTimestamp(user.updatedAt)}</dd>
												</div>
											</dl>
										</div>

										<div className="flex flex-wrap items-center gap-3">
											<button
												className="inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
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
																	throw new Error(result.error.message);
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
												type="button"
											>
												{user.role === "admin" ? "Revoke admin" : "Make admin"}
											</button>
											{isLastAdmin ? (
												<p className="text-xs leading-5 text-slate-500">
													At least one admin must remain.
												</p>
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
