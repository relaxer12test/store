import { getAuthClientErrorMessage } from "@/lib/auth-client-errors";
import { getRequiredConvexHttpUrl } from "@/lib/env";

async function postToBetterAuth<TData>(path: string, body: Record<string, string>) {
	const response = await fetch(new URL(path, getRequiredConvexHttpUrl()), {
		body: JSON.stringify(body),
		headers: {
			"content-type": "application/json",
		},
		method: "POST",
	});

	const payload = (await response
		.clone()
		.json()
		.catch(() => null)) as
		| (TData & {
				code?: string;
				message?: string;
		  })
		| null;

	if (!response.ok) {
		throw new Error(
			getAuthClientErrorMessage(
				payload ?? {
					status: response.status,
					statusText: response.statusText,
				},
				"Authentication request failed.",
			),
		);
	}

	return payload;
}

export function requestPasswordResetFromConvex(args: { email: string; redirectTo: string }) {
	return postToBetterAuth<{
		message: string;
		status: boolean;
	}>("/api/auth/request-password-reset", args);
}

export function resetPasswordFromConvex(args: { newPassword: string; token: string }) {
	return postToBetterAuth<{
		status: boolean;
	}>("/api/auth/reset-password", args);
}
