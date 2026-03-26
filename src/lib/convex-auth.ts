import { decodeJwt } from "jose";
import type { SessionEnvelope } from "@/shared/contracts/session";

const SECONDS_TO_MS = 1000;

export function getConvexTokenExpiresAt(token: string | null | undefined) {
	if (!token) {
		return null;
	}

	try {
		const claims = decodeJwt(token);

		return typeof claims.exp === "number" ? claims.exp * SECONDS_TO_MS : null;
	} catch {
		return null;
	}
}

export function hasFreshConvexToken(
	session: Pick<SessionEnvelope, "convexToken" | "convexTokenExpiresAt">,
	options?: {
		refreshBufferMs?: number;
	},
) {
	if (!session.convexToken) {
		return false;
	}

	if (!session.convexTokenExpiresAt) {
		return true;
	}

	return session.convexTokenExpiresAt > Date.now() + (options?.refreshBufferMs ?? 0);
}
