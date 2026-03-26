import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useTransition } from "react";
import { StatusPill } from "@/components/ui/feedback";
import { PageHeader, Panel } from "@/components/ui/layout";
import { authClient } from "@/lib/auth-client";
import { getSessionEnvelope } from "@/lib/auth-server";
import { hasAdminSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/internal-auth")({
	beforeLoad: async ({ context }) => {
		const currentSession = context.sessionManager.getState();
		const session =
			currentSession.authMode === "none" ? await getSessionEnvelope() : currentSession;

		context.setSession(session);

		if (hasAdminSession(session)) {
			throw redirect({
				to: "/internal",
			});
		}
	},
	component: InternalAuthRoute,
});

function InternalAuthRoute() {
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	const readTextField = (formData: FormData, key: string) => {
		const value = formData.get(key);

		return typeof value === "string" ? value : "";
	};

	return (
		<div className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24">
			<PageHeader
				description="Internal diagnostics now require a Better Auth session whose native role is `admin`."
				eyebrow="Admin access"
				title="Internal admin sign-in"
			/>

			<div className="mt-10">
				<Panel
					description="Sign in with a Better Auth account that already has the native `admin` role. The first merchant that completes the Shopify bridge is promoted automatically."
					title="Authenticate admin access"
				>
					<form
						className="space-y-5"
						onSubmit={(event) => {
							event.preventDefault();
							setError(null);

							const formData = new FormData(event.currentTarget);
							const email = readTextField(formData, "email").trim();
							const password = readTextField(formData, "password");

							startTransition(() => {
								void (async () => {
									try {
										const result = await authClient.signIn.email({
											email,
											password,
										});

										if (result.error) {
											throw new Error(result.error.message);
										}

										const session = await getSessionEnvelope();

										if (!hasAdminSession(session)) {
											await authClient.signOut();
											throw new Error("This Better Auth account is not an admin.");
										}

										window.location.assign("/internal");
									} catch (authError) {
										setError(
											authError instanceof Error
												? authError.message
												: "Admin authentication failed.",
										);
									}
								})();
							});
						}}
					>
						<div className="grid gap-5 sm:grid-cols-2">
							<label className="grid gap-2 text-sm font-semibold text-slate-900">
								<span>Email</span>
								<input
									autoComplete="email"
									className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
									name="email"
									placeholder="admin email"
									required
									type="email"
								/>
							</label>

							<label className="grid gap-2 text-sm font-semibold text-slate-900">
								<span>Password</span>
								<input
									autoComplete="current-password"
									className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:bg-white"
									name="password"
									placeholder="admin password"
									required
									type="password"
								/>
							</label>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<button
								className="inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
								disabled={isPending}
								type="submit"
							>
								{isPending ? "Signing in" : "Sign in"}
							</button>
							<StatusPill tone={error ? "blocked" : "watch"}>
								{error ? "Authentication failed" : "Admin-only route"}
							</StatusPill>
						</div>

						{error ? <p className="text-sm leading-6 text-red-700">{error}</p> : null}
					</form>
				</Panel>
			</div>
		</div>
	);
}
