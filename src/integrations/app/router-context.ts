import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { getRequiredConvexUrl, isServer } from "@/lib/env";
import type { SessionEnvelope } from "@/shared/contracts/session";

export interface AppRouterContext {
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
	preload: {
		ensureQueryData: QueryClient["ensureQueryData"];
	};
	setSession: (session: SessionEnvelope) => void;
}

interface ManagedAppRouterContext extends AppRouterContext {
	sessionFingerprint: string | null;
}

function getSessionFingerprint(session: SessionEnvelope) {
	return JSON.stringify({
		authMode: session.authMode,
		viewerId: session.viewer?.id ?? null,
		roles: session.roles,
	});
}

function createManagedAppRouterContext(): ManagedAppRouterContext {
	const convexQueryClient = new ConvexQueryClient(getRequiredConvexUrl());
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				gcTime: 1000 * 60 * 5,
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
				refetchOnWindowFocus: false,
			},
		},
	});

	convexQueryClient.connect(queryClient);

	let currentToken: string | null = null;
	let sessionFingerprint: string | null = null;

	const setSession = (session: SessionEnvelope) => {
		const nextFingerprint = getSessionFingerprint(session);

		if (!isServer && sessionFingerprint && sessionFingerprint !== nextFingerprint) {
			queryClient.clear();
		}

		sessionFingerprint = nextFingerprint;

		if (currentToken === session.convexToken) {
			return;
		}

		currentToken = session.convexToken;

		if (isServer) {
			if (!convexQueryClient.serverHttpClient) {
				return;
			}

			if (session.convexToken) {
				convexQueryClient.serverHttpClient.setAuth(session.convexToken);
			} else {
				convexQueryClient.serverHttpClient.clearAuth();
			}

			return;
		}

		if (session.convexToken) {
			convexQueryClient.convexClient.setAuth(async () => session.convexToken as string);
		} else {
			convexQueryClient.convexClient.clearAuth();
		}
	};

	return {
		queryClient,
		convexQueryClient,
		preload: {
			ensureQueryData: queryClient.ensureQueryData.bind(queryClient),
		},
		setSession,
		sessionFingerprint,
	};
}

let browserContext: ManagedAppRouterContext | undefined;

export function getAppRouterContext(): AppRouterContext {
	if (isServer) {
		return createManagedAppRouterContext();
	}

	browserContext ??= createManagedAppRouterContext();

	return browserContext;
}
