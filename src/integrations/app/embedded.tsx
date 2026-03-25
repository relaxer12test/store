import { createContext, useContext, useEffect, useSyncExternalStore } from "react";
import { getOptionalShopifyApiKey, isServer } from "@/lib/env";

export type EmbeddedBootstrapStatus = "idle" | "booting" | "ready" | "error";
export type EmbeddedBootstrapSource = "none" | "url" | "app-bridge";

export interface EmbeddedBootstrapState {
	apiKey: string | null;
	error: string | null;
	host: string | null;
	isEmbedded: boolean;
	sessionToken: string | null;
	shop: string | null;
	source: EmbeddedBootstrapSource;
	status: EmbeddedBootstrapStatus;
}

type Listener = () => void;

export interface EmbeddedAppManager {
	ensureReady: () => Promise<EmbeddedBootstrapState>;
	getState: () => EmbeddedBootstrapState;
	subscribe: (listener: Listener) => () => void;
}

const HOST_STORAGE_KEY = "shopify-admin-host";

function getPersistedHost() {
	if (isServer) {
		return null;
	}

	return window.sessionStorage.getItem(HOST_STORAGE_KEY);
}

function persistHost(host: string | null) {
	if (isServer || !host) {
		return;
	}

	window.sessionStorage.setItem(HOST_STORAGE_KEY, host);
}

function getShopifyGlobal() {
	if (isServer) {
		return undefined;
	}

	return window.shopify ?? globalThis.shopify;
}

function createInitialState(): EmbeddedBootstrapState {
	return {
		apiKey: getOptionalShopifyApiKey() ?? null,
		error: null,
		host: null,
		isEmbedded: false,
		sessionToken: null,
		shop: null,
		source: "none",
		status: "idle",
	};
}

export function createEmbeddedAppManager(): EmbeddedAppManager {
	let state = createInitialState();
	let bootPromise: Promise<EmbeddedBootstrapState> | null = null;
	const listeners = new Set<Listener>();

	const emit = () => {
		for (const listener of listeners) {
			listener();
		}
	};

	const setState = (nextState: EmbeddedBootstrapState) => {
		state = nextState;
		emit();
	};

	const ensureReady = async () => {
		if (isServer) {
			return state;
		}

		if (state.status === "ready") {
			return state;
		}

		if (bootPromise) {
			return bootPromise;
		}

		bootPromise = (async () => {
			const searchParams = new URLSearchParams(window.location.search);
			const hostFromUrl = searchParams.get("host");
			const host = hostFromUrl ?? getPersistedHost();
			const fallbackToken = searchParams.get("id_token");
			const shop = searchParams.get("shop");
			const isEmbedded = searchParams.get("embedded") === "1" || Boolean(host);
			let sessionToken = fallbackToken;
			let source: EmbeddedBootstrapSource = sessionToken ? "url" : "none";

			if (hostFromUrl) {
				persistHost(hostFromUrl);
			}

			if (isEmbedded) {
				const shopify = getShopifyGlobal();

				if (shopify?.idToken) {
					try {
						sessionToken = await shopify.idToken();
						source = "app-bridge";
					} catch {
						source = fallbackToken ? "url" : "app-bridge";
					}
				} else if (!fallbackToken) {
					source = "app-bridge";
				}
			}

			setState({
				...state,
				host,
				isEmbedded,
				sessionToken,
				shop,
				source,
				status: "booting",
			});

			const readyState: EmbeddedBootstrapState = {
				apiKey: getOptionalShopifyApiKey() ?? null,
				error: null,
				host,
				isEmbedded,
				sessionToken,
				shop,
				source,
				status: "ready",
			};

			setState(readyState);

			return readyState;
		})().catch((error) => {
			const nextState: EmbeddedBootstrapState = {
				...state,
				error:
					error instanceof Error
						? error.message
						: "Failed to initialize the embedded app bootstrap state.",
				status: "error",
			};

			setState(nextState);

			return nextState;
		});

		try {
			return await bootPromise;
		} finally {
			bootPromise = null;
		}
	};

	return {
		ensureReady,
		getState: () => state,
		subscribe: (listener) => {
			listeners.add(listener);

			return () => {
				listeners.delete(listener);
			};
		},
	};
}

const EmbeddedAppContext = createContext<EmbeddedAppManager | null>(null);

export function EmbeddedAppProvider({
	children,
	manager,
}: {
	children: React.ReactNode;
	manager: EmbeddedAppManager;
}) {
	useEffect(() => {
		void manager.ensureReady();
	}, [manager]);

	return <EmbeddedAppContext.Provider value={manager}>{children}</EmbeddedAppContext.Provider>;
}

function useEmbeddedAppManager() {
	const manager = useContext(EmbeddedAppContext);

	if (!manager) {
		throw new Error("Embedded app bootstrap must be used inside <EmbeddedAppProvider />.");
	}

	return manager;
}

export function useEmbeddedAppBootstrap() {
	const manager = useEmbeddedAppManager();

	return useSyncExternalStore(manager.subscribe, manager.getState, manager.getState);
}
