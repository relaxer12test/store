import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createEmbeddedAppManager, type EmbeddedAppManager } from "@/integrations/app/embedded";
import { getSessionEnvelope } from "@/lib/auth-server";
import { getRequiredConvexDeploymentUrl, isServer } from "@/lib/env";
import { hasEmbeddedMerchantSession, type SessionEnvelope } from "@/shared/contracts/session";

type Listener = () => void;
const CONVEX_TOKEN_REFRESH_BUFFER_MS = 1000 * 60;

const guestSession: SessionEnvelope = {
	authMode: "none",
	state: "ready",
	viewer: null,
	activeShop: null,
	roles: [],
	convexToken: null,
	convexTokenExpiresAt: null,
};

export interface SessionManager {
	getState: () => SessionEnvelope;
	subscribe: (listener: Listener) => () => void;
}

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
	sessionApi: {
		enableEmbeddedSessionBootstrap: () => void;
		ensureEmbeddedSession: (options?: { forceRefresh?: boolean }) => Promise<SessionEnvelope>;
	};
	sessionManager: SessionManager;
	setSession: (session: SessionEnvelope) => void;
}

interface ManagedAppRouterContext extends AppRouterContext {
	sessionFingerprint: string | null;
}

function createSessionManager(initialSession: SessionEnvelope) {
	let state = initialSession;
	const listeners = new Set<Listener>();

	return {
		getState: () => state,
		setState: (nextState: SessionEnvelope) => {
			state = nextState;

			for (const listener of listeners) {
				listener();
			}
		},
		subscribe: (listener: Listener) => {
			listeners.add(listener);

			return () => {
				listeners.delete(listener);
			};
		},
	};
}

function getSessionFingerprint(session: SessionEnvelope) {
	return JSON.stringify({
		activeShopId: session.activeShop?.id ?? null,
		authMode: session.authMode,
		viewerId: session.viewer?.id ?? null,
		roles: session.roles,
	});
}

function hasFreshConvexToken(session: SessionEnvelope) {
	return Boolean(
		session.convexToken &&
		session.convexTokenExpiresAt &&
		session.convexTokenExpiresAt > Date.now() + CONVEX_TOKEN_REFRESH_BUFFER_MS,
	);
}

function hasFreshMerchantToken(session: SessionEnvelope) {
	return hasEmbeddedMerchantSession(session) && hasFreshConvexToken(session);
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
	const convexQueryClient = new ConvexQueryClient(getRequiredConvexDeploymentUrl());
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

	let bootstrapPromise: Promise<SessionEnvelope> | null = null;
	let canBootstrapEmbeddedSession = isServer;
	let sessionFingerprint: string | null = null;
	const sessionManager = createSessionManager(guestSession);

	const setSession = (session: SessionEnvelope) => {
		const nextFingerprint = getSessionFingerprint(session);
		sessionManager.setState(session);

		if (!isServer && sessionFingerprint && sessionFingerprint !== nextFingerprint) {
			queryClient.clear();
		}

		sessionFingerprint = nextFingerprint;

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
	};

	const getEmbeddedHeaders = async () => {
		const sessionToken = await embeddedApp.getSessionToken();
		const headers = new Headers();

		if (sessionToken) {
			headers.set("Authorization", `Bearer ${sessionToken}`);
		}

		return headers;
	};

	const ensureEmbeddedSession = async (options?: { forceRefresh?: boolean }) => {
		if (isServer) {
			return sessionManager.getState();
		}

		if (!canBootstrapEmbeddedSession) {
			return sessionManager.getState();
		}

		const currentSession = sessionManager.getState();

		if (!options?.forceRefresh && hasFreshMerchantToken(currentSession)) {
			return currentSession;
		}

		if (bootstrapPromise) {
			return bootstrapPromise;
		}

		const nextPromise = (async () => {
			const embeddedState = await embeddedApp.ensureReady();

			if (!embeddedState.isEmbedded) {
				return sessionManager.getState();
			}

			if (!embeddedState.sessionToken) {
				return sessionManager.getState();
			}

			try {
				const response = await fetch("/api/shopify/bootstrap", {
					method: "POST",
					headers: mergeHeaders(
						{
							Accept: "application/json",
						},
						await getEmbeddedHeaders(),
					),
				});

				if (!response.ok) {
					throw new Error(`Embedded bootstrap failed with status ${response.status}.`);
				}

				const session = (await response.json()) as SessionEnvelope;
				setSession(session);

				return session;
			} catch {
				const offlineSession: SessionEnvelope = {
					authMode: "embedded",
					state: "offline",
					viewer: null,
					activeShop: null,
					roles: [],
					convexToken: null,
					convexTokenExpiresAt: null,
				};
				setSession(offlineSession);

				return offlineSession;
			}
		})();

		bootstrapPromise = nextPromise.finally(() => {
			if (bootstrapPromise === nextPromise) {
				bootstrapPromise = null;
			}
		});

		return bootstrapPromise;
	};

	const enableEmbeddedSessionBootstrap = () => {
		if (!isServer) {
			canBootstrapEmbeddedSession = true;
		}
	};

	if (!isServer) {
		convexQueryClient.convexClient.setAuth(async ({ forceRefreshToken }) => {
			const currentSession = sessionManager.getState();

			if (!forceRefreshToken && hasFreshConvexToken(currentSession)) {
				return currentSession.convexToken;
			}

			const session = await ensureEmbeddedSession({
				forceRefresh: forceRefreshToken,
			});

			if (session.authMode === "internal") {
				const refreshedSession = await getSessionEnvelope();
				setSession(refreshedSession);

				return refreshedSession.convexToken;
			}

			return session.convexToken;
		});
	}

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
		sessionApi: {
			enableEmbeddedSessionBootstrap,
			ensureEmbeddedSession,
		},
		sessionManager,
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
