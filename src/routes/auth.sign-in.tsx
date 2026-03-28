import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/cata/button";
import { Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
import { Heading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Text } from "@/components/ui/cata/text";
import { authClient } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";
import { getCurrentViewerServer } from "@/lib/auth-functions";
import { currentViewerQuery } from "@/lib/auth-queries";
import { hasAdminViewer } from "@/shared/contracts/auth";

export const Route = createFileRoute("/auth/sign-in")({
	component: SignInRoute,
});

function SignInRoute() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const signInMutation = useMutation({
		mutationFn: async (values: { email: string; password: string }) => {
			const result = await authClient.signIn.email(values);

			if (result.error) {
				throw new Error(getAuthClientErrorMessage(result.error, "Admin authentication failed."));
			}

			const viewer = await getCurrentViewerServer();
			queryClient.setQueryData(currentViewerQuery.queryKey, viewer);

			if (!hasAdminViewer(viewer)) {
				await authClient.signOut();
				queryClient.setQueryData(currentViewerQuery.queryKey, null);
				throw new Error("This Better Auth account is not an admin.");
			}

			return viewer;
		},
	});
	const form = useForm({
		defaultValues: {
			email: "",
			password: "",
		},
		onSubmit: async ({ value }) => {
			const viewer = await signInMutation
				.mutateAsync({
					email: value.email.trim(),
					password: value.password,
				})
				.catch(() => null);

			if (!viewer) {
				return;
			}

			await navigate({
				to: "/internal/overview",
			});
		},
	});
	return (
		<div className="w-full max-w-sm">
			<Heading>Sign in</Heading>
			<Text>Internal diagnostics require an admin session.</Text>

			<form
				className="mt-8"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void form.handleSubmit();
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

				<form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
					{([canSubmit, isSubmitting]) => (
						<div className="mt-6 flex items-center justify-between">
							<Button color="dark/zinc" disabled={!canSubmit} type="submit">
								{isSubmitting ? "Signing in\u2026" : "Sign in"}
							</Button>
							<Button
								plain
								onClick={() => void navigate({ to: "/auth/forgot-password" })}
								type="button"
							>
								Forgot password?
							</Button>
						</div>
					)}
				</form.Subscribe>

				{signInMutation.error ? (
					<div className="mt-4">
						<Text className="text-red-600 dark:text-red-500" role="alert">
							{signInMutation.error.message}
						</Text>
					</div>
				) : null}
			</form>
		</div>
	);
}
