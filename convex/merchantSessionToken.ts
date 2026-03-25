import { type JWK, SignJWT, importJWK } from "jose";
import type { ViewerRole } from "../src/shared/contracts/session";
import type { Id } from "./_generated/dataModel";

const AUTH_ALGORITHM = "ES256";
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 15;

export interface MerchantSessionTokenClaims {
	email?: string;
	merchantActorId: Id<"merchantActors">;
	name: string;
	roles: ViewerRole[];
	shopDomain: string;
	shopId: Id<"shops">;
	shopifyUserId: string;
}

export interface InternalSessionTokenClaims {
	email?: string;
	internalUserId: string;
	name: string;
	roles: ViewerRole[];
}

let signingKeyPromise: Promise<Awaited<ReturnType<typeof importJWK>>> | null = null;

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

function parseJsonEnv<T>(name: string): T {
	try {
		return JSON.parse(getRequiredEnv(name)) as T;
	} catch (error) {
		throw new Error(
			`Convex environment variable ${name} must contain valid JSON: ${
				error instanceof Error ? error.message : "invalid JSON"
			}`,
		);
	}
}

function getSigningJwk() {
	const jwk = parseJsonEnv<JWK & { kid?: string; kty?: string }>("CONVEX_APP_AUTH_PRIVATE_JWK");

	if (jwk.kty !== "EC") {
		throw new Error("CONVEX_APP_AUTH_PRIVATE_JWK must be an EC private JWK for ES256.");
	}

	if (!jwk.kid) {
		throw new Error("CONVEX_APP_AUTH_PRIVATE_JWK must include a `kid`.");
	}

	return jwk as JWK & { kid: string; kty: "EC" };
}

function getTokenTtlSeconds() {
	const rawValue = (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env?.CONVEX_APP_AUTH_TTL_SECONDS;

	if (!rawValue) {
		return DEFAULT_TOKEN_TTL_SECONDS;
	}

	const ttlSeconds = Number.parseInt(rawValue, 10);

	if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
		throw new Error("CONVEX_APP_AUTH_TTL_SECONDS must be a positive integer.");
	}

	return ttlSeconds;
}

async function getSigningKey() {
	signingKeyPromise ??= importJWK(getSigningJwk(), AUTH_ALGORITHM);

	return signingKeyPromise;
}

async function issueSessionToken({
	claims,
	subject,
}: {
	claims: Record<string, string | string[] | undefined>;
	subject: string;
}) {
	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + getTokenTtlSeconds();
	const issuer = getRequiredEnv("CONVEX_APP_AUTH_ISSUER");
	const audience = getRequiredEnv("CONVEX_APP_AUTH_AUDIENCE");
	const signingJwk = getSigningJwk();
	const signingKey = await getSigningKey();

	const token = await new SignJWT(claims)
		.setProtectedHeader({
			alg: AUTH_ALGORITHM,
			kid: signingJwk.kid,
			typ: "JWT",
		})
		.setIssuer(issuer)
		.setAudience(audience)
		.setSubject(subject)
		.setIssuedAt(issuedAt)
		.setExpirationTime(expiresAt)
		.sign(signingKey);

	return {
		token,
		expiresAt: expiresAt * 1000,
	};
}

export async function issueMerchantSessionToken(claims: MerchantSessionTokenClaims) {
	return await issueSessionToken({
		claims: {
			authMode: "embedded",
			email: claims.email,
			merchantActorId: claims.merchantActorId,
			name: claims.name,
			roles: claims.roles,
			shopDomain: claims.shopDomain,
			shopId: claims.shopId,
			shopifyUserId: claims.shopifyUserId,
		},
		subject: claims.merchantActorId,
	});
}

export async function issueInternalSessionToken(claims: InternalSessionTokenClaims) {
	return await issueSessionToken({
		claims: {
			authMode: "internal",
			email: claims.email,
			internalUserId: claims.internalUserId,
			name: claims.name,
			roles: claims.roles,
		},
		subject: claims.internalUserId,
	});
}
