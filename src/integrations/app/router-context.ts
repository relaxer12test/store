import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createEmbeddedAppManager, type EmbeddedAppManager } from "@/integrations/app/embedded";
import { getRequiredConvexUrl, isServer } from "@/lib/env";
import type { SessionEnvelope } from "@/shared/contracts/session";

export interface AppRouterContext {
	embeddedApp: EmbeddedAppManager;
	queryClient: QueryClient;
	convexQueryClient: ConvexQueryClient;
	preload: {
		ensureQueryData: QueryClient["ensureQueryData"];
	};
	request: {
		fetch: typeof fetch;
		getEmbeddedHeaders: () => Promise<Headers>;
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

function mergeHeaders(...headerSets: Array<HeadersInit | undefined>) {
	const headers = new Headers();

	for (const headerSet of headerSets) {
		if (!headerSet) {
			continue;
		}

		const nextHeaders = new Headers(headerSet);

		for (const [key, value] of nextHeaders.entries()) {
			headers.set(key, value);
		}
	}

	return headers;
}

function createManagedAppRouterContext(): ManagedAppRouterContext {
	const convexQueryClient = new ConvexQueryClient(getRequiredConvexUrl());
	const embeddedApp = createEmbeddedAppManager();
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

	const getEmbeddedHeaders = async () => {
		const embeddedState = await embeddedApp.ensureReady();
		const headers = new Headers();

		if (embeddedState.sessionToken) {
			headers.set("Authorization", `Bearer ${embeddedState.sessionToken}`);
		}

		return headers;
	};

	return {
		embeddedApp,
		queryClient,
		convexQueryClient,
		preload: {
			ensureQueryData: queryClient.ensureQueryData.bind(queryClient),
		},
		request: {
			fetch: async (input, init) => {
				const embeddedHeaders = await getEmbeddedHeaders();

				return fetch(input, {
					...init,
					headers: mergeHeaders(init?.headers, embeddedHeaders),
				});
			},
			getEmbeddedHeaders,
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
