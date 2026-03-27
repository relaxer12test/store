import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/cata/button";
import { ErrorMessage, Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
import { Heading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Text } from "@/components/ui/cata/text";
import { authClient } from "@/lib/auth-client";
import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";
import { getSessionEnvelope } from "@/lib/auth-server";
import { hasAdminSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/auth/sign-in")({
	component: SignInRoute,
});

function SignInRoute() {
	const navigate = useNavigate();
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, setIsPending] = useState(false);

	return (
		<div className="w-full max-w-sm">
			<Heading>Sign in</Heading>
			<Text>Internal diagnostics require an admin session.</Text>

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
						<Field>
							<Label>Password</Label>
							<Input autoComplete="current-password" name="password" required type="password" />
						</Field>
					</FieldGroup>
				</Fieldset>

				<div className="mt-6 flex items-center justify-between">
					<Button color="dark/zinc" disabled={isPending} type="submit">
						{isPending ? "Signing in\u2026" : "Sign in"}
					</Button>
					<Button
						plain
						onClick={() => void navigate({ to: "/auth/forgot-password" })}
						type="button"
					>
						Forgot password?
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
