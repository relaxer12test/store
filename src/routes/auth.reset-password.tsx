import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/cata/button";
import { ErrorMessage, Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
import { Heading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Text } from "@/components/ui/cata/text";
import { authClient } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";

export const Route = createFileRoute("/auth/reset-password")({
	validateSearch: (search: Record<string, unknown>) => ({
		token: typeof search.token === "string" ? search.token : undefined,
		error: typeof search.error === "string" ? search.error : undefined,
	}),
	component: ResetPasswordRoute,
});

function ResetPasswordRoute() {
	const { token, error: urlError } = Route.useSearch();
	const resetMutation = useMutation({
		mutationFn: async (value: { confirmPassword: string; newPassword: string }) => {
			if (value.newPassword !== value.confirmPassword) {
				throw new Error("Passwords do not match.");
			}

			if (value.newPassword.length < 8) {
				throw new Error("Password must be at least 8 characters.");
			}

			const result = await authClient.resetPassword({
				newPassword: value.newPassword,
				token: token!,
			});

			if (result.error) {
				throw new Error(getAuthClientErrorMessage(result.error, "Failed to reset password."));
			}
		},
	});
	const form = useForm({
		defaultValues: {
			confirmPassword: "",
			newPassword: "",
		},
		onSubmit: async ({ value }) => {
			await resetMutation.mutateAsync(value);
		},
	});

	if (resetMutation.isSuccess) {
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

	if (urlError || !token) {
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
					await form.handleSubmit();
				}}
			>
				<Fieldset>
					<FieldGroup>
						<form.Field name="newPassword">
							{(field) => (
								<Field>
									<Label>New password</Label>
									<Input
										autoComplete="new-password"
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.currentTarget.value)}
										required
										type="password"
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
						<form.Field name="confirmPassword">
							{(field) => (
								<Field>
									<Label>Confirm password</Label>
									<Input
										autoComplete="new-password"
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.currentTarget.value)}
										required
										type="password"
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
					</FieldGroup>
				</Fieldset>

				<div className="mt-6">
					<Button color="dark/zinc" disabled={resetMutation.isPending} type="submit">
						{resetMutation.isPending ? "Resetting\u2026" : "Reset password"}
					</Button>
				</div>

				{resetMutation.error ? (
					<div className="mt-4">
						<ErrorMessage>{resetMutation.error.message}</ErrorMessage>
					</div>
				) : null}
			</form>
		</div>
	);
}
