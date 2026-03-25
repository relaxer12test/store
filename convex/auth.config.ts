import type { AuthConfig } from "convex/server";

function getRequiredEnv(name: string) {
	const env = (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env;
	const value = env?.[name];

	if (!value) {
		throw new Error(`Missing Convex environment variable ${name}.`);
	}

	return value;
}

export default {
	providers: [
		{
			type: "customJwt",
			applicationID: getRequiredEnv("CONVEX_APP_AUTH_AUDIENCE"),
			issuer: getRequiredEnv("CONVEX_APP_AUTH_ISSUER"),
			jwks: `data:application/json;charset=utf-8,${encodeURIComponent(
				getRequiredEnv("CONVEX_APP_AUTH_JWKS"),
			)}`,
			algorithm: "ES256",
		},
	],
} satisfies AuthConfig;
