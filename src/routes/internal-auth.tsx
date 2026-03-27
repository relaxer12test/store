import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/cata/button";
import { Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
import { Input } from "@/components/ui/cata/input";
import { authClient } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";
import { requestPasswordResetFromConvex } from "@/lib/auth-reset-client";
import { getSessionEnvelope } from "@/lib/auth-server";
import { hasAdminSession } from "@/shared/contracts/session";

type AuthView = "sign-in" | "forgot-password" | "reset-email-sent";

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
	const [view, setView] = useState<AuthView>("sign-in");
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);
	const [sentEmail, setSentEmail] = useState("");

	const switchTo = (nextView: AuthView) => {
		setError(null);
		setView(nextView);
	};

	return (
		<div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
			<div className="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
				{view === "sign-in" && (
					<>
						<p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
							Admin access
						</p>
						<h1 className="mt-3 font-serif text-3xl text-slate-950">Sign in</h1>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							Internal diagnostics require an admin session.
						</p>

						<form
							className="mt-8"
							onSubmit={async (event) => {
								event.preventDefault();
								if (isPending) return;
								setError(null);
								setIsPending(true);

								const formData = new FormData(event.currentTarget);
								const password = (formData.get("password") as string) ?? "";
								const normalizedEmail = email.trim();

								try {
									const result = await authClient.signIn.email({
										email: normalizedEmail,
										password,
									});

									if (result.error) {
										throw new Error(
											getAuthClientErrorMessage(result.error, "Admin authentication failed."),
										);
									}

									const session = await getSessionEnvelope();

									if (!hasAdminSession(session)) {
										await authClient.signOut();
										throw new Error("This Better Auth account is not an admin.");
									}

									window.location.assign("/internal");
								} catch (authError) {
									setError(
										authError instanceof Error ? authError.message : "Admin authentication failed.",
									);
								} finally {
									setIsPending(false);
								}
							}}
						>
							<Fieldset>
								<FieldGroup className="space-y-4">
									<Field>
										<Label>Email address</Label>
										<Input
											autoComplete="email"
											name="email"
											placeholder="admin@example.com"
											required
											type="email"
											value={email}
											onChange={(event) => setEmail(event.currentTarget.value)}
										/>
									</Field>
									<Field>
										<Label>Password</Label>
										<Input
											autoComplete="current-password"
											name="password"
											required
											type="password"
										/>
									</Field>
								</FieldGroup>
							</Fieldset>

							<div className="mt-6 flex items-center justify-between">
								<Button color="dark/zinc" disabled={isPending} type="submit">
									{isPending ? "Signing in\u2026" : "Sign in"}
								</Button>
								<button
									className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
									onClick={() => switchTo("forgot-password")}
									type="button"
								>
									Forgot password?
								</button>
							</div>

							{error ? <p className="mt-4 text-sm leading-6 text-red-600">{error}</p> : null}
						</form>
					</>
				)}

				{view === "forgot-password" && (
					<>
						<p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
							Admin access
						</p>
						<h1 className="mt-3 font-serif text-3xl text-slate-950">Reset password</h1>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							Enter your admin email and we'll send a reset link.
						</p>

						<form
							className="mt-8"
							onSubmit={async (event) => {
								event.preventDefault();
								if (isPending) return;
								setError(null);
								setIsPending(true);

								const normalizedEmail = email.trim();

								try {
									await requestPasswordResetFromConvex({
										email: normalizedEmail,
										redirectTo: `${window.location.origin}/internal-reset-password`,
									});

									setSentEmail(normalizedEmail);
									setView("reset-email-sent");
								} catch (resetError) {
									setError(
										resetError instanceof Error ? resetError.message : "Failed to send reset link.",
									);
								} finally {
									setIsPending(false);
								}
							}}
						>
							<Fieldset>
								<FieldGroup className="space-y-4">
									<Field>
										<Label>Email address</Label>
										<Input
											autoComplete="email"
											name="email"
											placeholder="admin@example.com"
											required
											type="email"
											value={email}
											onChange={(event) => setEmail(event.currentTarget.value)}
										/>
									</Field>
								</FieldGroup>
							</Fieldset>

							<div className="mt-6 flex items-center gap-3">
								<Button color="dark/zinc" disabled={isPending} type="submit">
									{isPending ? "Sending\u2026" : "Send reset link"}
								</Button>
								<Button onClick={() => switchTo("sign-in")} plain type="button">
									Back to sign in
								</Button>
							</div>

							{error ? <p className="mt-4 text-sm leading-6 text-red-600">{error}</p> : null}
						</form>
					</>
				)}

				{view === "reset-email-sent" && (
					<div className="text-center">
						<p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
							Admin access
						</p>
						<h1 className="mt-3 font-serif text-3xl text-slate-950">Check your email</h1>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							If an account exists for{" "}
							<span className="font-medium text-slate-900">{sentEmail}</span>, you'll receive a
							password reset link shortly.
						</p>
						<div className="mt-8">
							<Button onClick={() => switchTo("sign-in")} plain type="button">
								Back to sign in
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
