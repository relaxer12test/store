import { symmetricDecrypt } from "better-auth/crypto";
import { type JWK, SignJWT, importJWK } from "jose";
import type { ViewerRole } from "@/shared/contracts/session";
import type { Id } from "./_generated/dataModel";

const AUTH_ALGORITHM = "RS256";
const AUTH_AUDIENCE = "convex";
const DEFAULT_TOKEN_TTL_SECONDS = 60 * 15;

export interface BetterAuthJwkDoc {
	alg?: string | null;
	createdAt: number;
	crv?: string | null;
	expiresAt?: number | null;
	id: string;
	privateKey: string;
	publicKey: string;
}

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
let signingKeyCacheKey: string | null = null;

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

function getRequiredConvexIssuer() {
	return getRequiredEnv("CONVEX_SITE_URL");
}

function getBetterAuthSecret() {
	return getRequiredEnv("BETTER_AUTH_SECRET");
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

async function getPrivateWebKey(signingJwk: BetterAuthJwkDoc) {
	const trimmedPrivateKey = signingJwk.privateKey.trim();

	if (trimmedPrivateKey.startsWith('"')) {
		return await symmetricDecrypt({
			data: JSON.parse(trimmedPrivateKey) as string,
			key: getBetterAuthSecret(),
		});
	}

	return trimmedPrivateKey;
}

async function getSigningKey(signingJwk: BetterAuthJwkDoc) {
	const cacheKey = `${signingJwk.id}:${signingJwk.privateKey}`;

	if (!signingKeyPromise || signingKeyCacheKey !== cacheKey) {
		signingKeyCacheKey = cacheKey;
		signingKeyPromise = (async () => {
			const privateWebKey = await getPrivateWebKey(signingJwk);
			const privateJwk = JSON.parse(privateWebKey) as JWK;
			const algorithm = signingJwk.alg ?? AUTH_ALGORITHM;

			if (algorithm !== AUTH_ALGORITHM) {
				throw new Error(
					`Merchant embedded tokens require ${AUTH_ALGORITHM}, received ${algorithm}.`,
				);
			}

			return await importJWK(privateJwk, algorithm);
		})();
	}

	return await signingKeyPromise;
}

async function issueSessionToken({
	claims,
	signingJwk,
	subject,
}: {
	claims: Record<string, string | string[] | undefined>;
	signingJwk: BetterAuthJwkDoc;
	subject: string;
}) {
	const issuedAt = Math.floor(Date.now() / 1000);
	const expiresAt = issuedAt + getTokenTtlSeconds();
	const issuer = getRequiredConvexIssuer();
	const signingKey = await getSigningKey(signingJwk);

	const token = await new SignJWT(claims)
		.setProtectedHeader({
			alg: AUTH_ALGORITHM,
			kid: signingJwk.id,
			typ: "JWT",
		})
		.setIssuer(issuer)
		.setAudience(AUTH_AUDIENCE)
		.setSubject(subject)
		.setIssuedAt(issuedAt)
		.setExpirationTime(expiresAt)
		.sign(signingKey);

	return {
		token,
		expiresAt: expiresAt * 1000,
	};
}

export async function issueMerchantSessionToken({
	claims,
	signingJwk,
}: {
	claims: MerchantSessionTokenClaims;
	signingJwk: BetterAuthJwkDoc;
}) {
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
			userId: claims.merchantActorId,
		},
		signingJwk,
		subject: claims.merchantActorId,
	});
}

export async function issueInternalSessionToken({
	claims,
	signingJwk,
}: {
	claims: InternalSessionTokenClaims;
	signingJwk: BetterAuthJwkDoc;
}) {
	return await issueSessionToken({
		claims: {
			authMode: "internal",
			email: claims.email,
			internalUserId: claims.internalUserId,
			name: claims.name,
			roles: claims.roles,
		},
		signingJwk,
		subject: claims.internalUserId,
	});
}
