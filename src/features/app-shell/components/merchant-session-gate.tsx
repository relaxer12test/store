import type { PropsWithChildren, ReactNode } from "react";
import { useAppAuth } from "@/lib/auth-client";

export function MerchantSessionGate({
	children,
	fallback = null,
}: PropsWithChildren<{ fallback?: ReactNode }>) {
	const auth = useAppAuth();

	if (!auth.isMerchant) {
		return fallback;
	}

	return children;
}
