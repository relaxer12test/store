import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/cata/button";
import { Heading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";

export const Route = createFileRoute("/auth/reset-sent")({
	validateSearch: (search: Record<string, unknown>) => ({
		email: typeof search.email === "string" ? search.email : "",
	}),
	component: ResetSentRoute,
});

function ResetSentRoute() {
	const { email } = Route.useSearch();

	return (
		<div className="w-full max-w-sm text-center">
			<Heading>Check your email</Heading>
			<Text>
				If an account exists for <strong>{email}</strong>, you'll receive a password reset link
				shortly.
			</Text>
			<div className="mt-8">
				<Button plain href="/auth/sign-in">
					Back to sign in
				</Button>
			</div>
		</div>
	);
}
