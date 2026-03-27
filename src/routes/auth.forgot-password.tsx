import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/cata/button";
import { ErrorMessage, Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
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
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	return (
		<div className="w-full max-w-sm">
			<Heading>Reset password</Heading>
			<Text>Enter your admin email and we'll send a reset link.</Text>

			<form
				className="mt-8"
				onSubmit={async (event) => {
					event.preventDefault();
					if (isPending) return;
					setError(null);
					setIsPending(true);

					const normalizedEmail = email.trim();

					try {
						const result = await authClient.requestPasswordReset({
							email: normalizedEmail,
							redirectTo: `${window.location.origin}/auth/reset-password`,
						});

						if (result.error) {
							throw new Error(
								getAuthClientErrorMessage(result.error, "Failed to send reset link."),
							);
						}

						void navigate({
							to: "/auth/reset-sent",
							search: { email: normalizedEmail },
						});
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
					<FieldGroup>
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
					<Button plain onClick={() => void navigate({ to: "/auth/sign-in" })} type="button">
						Back to sign in
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
