import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/cata/button";
import { ErrorMessage, Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
import { Heading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Text } from "@/components/ui/cata/text";
import { authClient } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";

type ResetView = "form" | "success" | "error";

export const Route = createFileRoute("/auth/reset-password")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : undefined,
		error: typeof search.error === "string" ? search.error : undefined,
	}),
	component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
	const { token, error: urlError } = Route.useSearch();
	const initialView: ResetView = urlError ? "error" : token ? "form" : "error";

	const [view, setView] = useState<ResetView>(initialView);
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	if (view === "success") {
		return (
			<div className="w-full max-w-sm text-center">
				<Heading>Password updated</Heading>
				<Text>
					Your password has been reset successfully. You can now sign in with your new password.
				</Text>
				<div className="mt-8">
					<Button color="dark/zinc" href="/auth/sign-in">
						Go to sign in
					</Button>
				</div>
			</div>
		);
	}

	if (view === "error") {
		return (
			<div className="w-full max-w-sm text-center">
				<Heading>Link expired</Heading>
				<Text>This password reset link is invalid or has expired. Please request a new one.</Text>
				<div className="mt-8">
					<Button color="dark/zinc" href="/auth/sign-in">
						Back to sign in
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full max-w-sm">
			<Heading>Set your new password</Heading>
			<Text>Enter a new password for your admin account.</Text>

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
							throw new Error(
								getAuthClientErrorMessage(result.error, "Failed to reset password."),
							);
						}

						setView("success");
					} catch (resetError) {
						setError(
							resetError instanceof Error ? resetError.message : "Failed to reset password.",
						);
					} finally {
						setIsPending(false);
					}
				}}
			>
				<Fieldset>
					<FieldGroup>
						<Field>
							<Label>New password</Label>
							<Input autoComplete="new-password" name="newPassword" required type="password" />
						</Field>
						<Field>
							<Label>Confirm password</Label>
							<Input autoComplete="new-password" name="confirmPassword" required type="password" />
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
		</div>
	);
}
