import type { PropsWithChildren, ReactNode } from "react";
import { useAppAuth } from "@/lib/auth-client";
import { hasMerchantAppAccess } from "@/shared/contracts/auth";

export function MerchantSessionGate({
	children,
	fallback = null,
}: PropsWithChildren<{ fallback?: ReactNode }>) {
	const auth = useAppAuth();

	if (!hasMerchantAppAccess(auth.viewer)) {
		return fallback;
	}

	return children;
}
