import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/cata/button";
import { ErrorMessage, Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
import { Heading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Text } from "@/components/ui/cata/text";
import { authClient } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";
import { refreshInternalSessionEnvelope } from "@/lib/direct-convex-auth";
import { hasAdminSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/auth/sign-in")({
	component: SignInRoute,
});

function SignInRoute() {
	const navigate = useNavigate();
	const signInMutation = useMutation({
		mutationFn: async (values: { email: string; password: string }) => {
			const result = await authClient.signIn.email(values);

			if (result.error) {
				throw new Error(getAuthClientErrorMessage(result.error, "Admin authentication failed."));
			}

			const session = await refreshInternalSessionEnvelope();

			if (!hasAdminSession(session)) {
				await authClient.signOut();
				throw new Error("This Better Auth account is not an admin.");
			}
		},
	});
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			await signInMutation.mutateAsync({
				email: value.email.trim(),
				password: value.password,
			});
			window.location.assign("/internal");
		},
	});

	return (
		<div className="w-full max-w-sm">
			<Heading>Sign in</Heading>
			<Text>Internal diagnostics require an admin session.</Text>

			<form
				className="mt-8"
				onSubmit={async (event) => {
					event.preventDefault();
					await form.handleSubmit();
				}}
			>
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
						<form.Field name="password">
							{(field) => (
								<Field>
									<Label>Password</Label>
									<Input
										autoComplete="current-password"
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

				<div className="mt-6 flex items-center justify-between">
					<Button color="dark/zinc" disabled={signInMutation.isPending} type="submit">
						{signInMutation.isPending ? "Signing in\u2026" : "Sign in"}
					</Button>
					<Button
						plain
						onClick={() => void navigate({ to: "/auth/forgot-password" })}
						type="button"
					>
						Forgot password?
					</Button>
				</div>

				{signInMutation.error ? (
					<div className="mt-4">
						<ErrorMessage>{signInMutation.error.message}</ErrorMessage>
					</div>
				) : null}
			</form>
		</div>
	);
}
