import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/cata/button";
import { ErrorMessage, Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
import { Input } from "@/components/ui/cata/input";
import { authClient } from "@/lib/auth-client";

type ResetView = "form" | "success" | "error";

export const Route = createFileRoute("/internal-reset-password")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : undefined,
		error: typeof search.error === "string" ? search.error : undefined,
	}),
	component: InternalResetPasswordRoute,
});

function InternalResetPasswordRoute() {
	const { token, error: urlError } = Route.useSearch();
	const initialView: ResetView = urlError ? "error" : token ? "form" : "error";

	const [view, setView] = useState<ResetView>(initialView);
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	return (
		<div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
			<div className="w-full max-w-md rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
				{view === "form" && (
					<>
						<p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
							Password reset
						</p>
						<h1 className="mt-3 font-serif text-3xl text-slate-950">Set your new password</h1>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							Enter a new password for your admin account.
						</p>

						<form
							className="mt-8"
							onSubmit={async (event) => {
								event.preventDefault();
								if (isPending) return;
								setError(null);
								setIsPending(true);

								const formData = new FormData(event.currentTarget);
								const newPassword = (formData.get("newPassword") as string) ?? "";
								const confirmPassword = (formData.get("confirmPassword") as string) ?? "";

								if (newPassword !== confirmPassword) {
									setError("Passwords do not match.");
									setIsPending(false);
									return;
								}

								if (newPassword.length < 8) {
									setError("Password must be at least 8 characters.");
									setIsPending(false);
									return;
								}

								try {
									const result = await authClient.resetPassword({
										newPassword,
										token: token!,
									});

									if (result.error) {
										throw new Error(result.error.message);
									}

									setView("success");
								} catch (resetError) {
									setError(
										resetError instanceof Error
											? resetError.message
											: "Failed to reset password.",
									);
								} finally {
									setIsPending(false);
								}
							}}
						>
							<Fieldset>
								<FieldGroup className="space-y-4">
									<Field>
										<Label>New password</Label>
										<Input
											autoComplete="new-password"
											name="newPassword"
											required
											type="password"
										/>
									</Field>
									<Field>
										<Label>Confirm password</Label>
										<Input
											autoComplete="new-password"
											name="confirmPassword"
											required
											type="password"
										/>
									</Field>
								</FieldGroup>
							</Fieldset>

							<div className="mt-6">
								<Button color="dark/zinc" disabled={isPending} type="submit">
									{isPending ? "Resetting\u2026" : "Reset password"}
								</Button>
							</div>

							{error ? (
								<div className="mt-4">
									<ErrorMessage>{error}</ErrorMessage>
								</div>
							) : null}
						</form>
					</>
				)}

				{view === "success" && (
					<div className="text-center">
						<p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
							Password reset
						</p>
						<h1 className="mt-3 font-serif text-3xl text-slate-950">Password updated</h1>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							Your password has been reset successfully. You can now sign in with your new password.
						</p>
						<div className="mt-8">
							<Button color="dark/zinc" href="/internal-auth">
								Go to sign in
							</Button>
						</div>
					</div>
				)}

				{view === "error" && (
					<div className="text-center">
						<p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
							Password reset
						</p>
						<h1 className="mt-3 font-serif text-3xl text-slate-950">Link expired</h1>
						<p className="mt-3 text-sm leading-6 text-slate-600">
							This password reset link is invalid or has expired. Please request a new one.
						</p>
						<div className="mt-8">
							<Button color="dark/zinc" href="/internal-auth">
								Back to sign in
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
