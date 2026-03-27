import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/cata/button";
import { Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
import { Heading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Text } from "@/components/ui/cata/text";
import { authClient } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";

export const Route = createFileRoute("/auth/forgot-password")({
	component: ForgotPasswordRoute,
});

function ForgotPasswordRoute() {
	const navigate = useNavigate();
	const resetMutation = useMutation({
		mutationFn: async (email: string) => {
			const result = await authClient.requestPasswordReset({
				email,
				redirectTo: `${window.location.origin}/auth/reset-password`,
			});

			if (result.error) {
				throw new Error(getAuthClientErrorMessage(result.error, "Failed to send reset link."));
			}
		},
	});
	const form = useForm({
		defaultValues: {
			email: "",
		},
		onSubmit: async ({ value }) => {
			const normalizedEmail = value.email.trim();
			const didRequestReset = await resetMutation
				.mutateAsync(normalizedEmail)
				.then(() => true)
				.catch(() => false);

			if (!didRequestReset) {
				return;
			}

			void navigate({
				to: "/auth/reset-sent",
				search: { email: normalizedEmail },
			});
		},
	});

	return (
		<div className="w-full max-w-sm">
			<Heading>Reset password</Heading>
			<Text>Enter your admin email and we'll send a reset link.</Text>

			<div className="mt-8">
				<Fieldset>
					<FieldGroup>
						<form.Field name="email">
							{(field) => (
								<Field>
									<Label>Email address</Label>
									<Input
										autoComplete="email"
										name={field.name}
										onBlur={field.handleBlur}
										onChange={(event) => field.handleChange(event.currentTarget.value)}
										placeholder="admin@example.com"
										required
										type="email"
										value={field.state.value}
									/>
								</Field>
							)}
						</form.Field>
					</FieldGroup>
				</Fieldset>

				<div className="mt-6 flex items-center gap-3">
					<Button
						color="dark/zinc"
						disabled={resetMutation.isPending}
						onClick={() => void form.handleSubmit()}
						type="button"
					>
						{resetMutation.isPending ? "Sending\u2026" : "Send reset link"}
					</Button>
					<Button plain onClick={() => void navigate({ to: "/auth/sign-in" })} type="button">
						Back to sign in
					</Button>
				</div>

				{resetMutation.error ? (
					<div className="mt-4">
						<Text className="text-red-600 dark:text-red-500" role="alert">
							{resetMutation.error.message}
						</Text>
					</div>
				) : null}
			</div>
		</div>
	);
}
