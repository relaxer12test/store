import type { PropsWithChildren, ReactNode } from "react";
import { useSessionEnvelope } from "@/lib/auth-client";
import { hasEmbeddedMerchantSession } from "@/shared/contracts/session";

export function MerchantSessionGate({
	children,
	fallback = null,
}: PropsWithChildren<{ fallback?: ReactNode }>) {
	const session = useSessionEnvelope();

	if (!hasEmbeddedMerchantSession(session)) {
		return fallback;
	}

	return children;
}
