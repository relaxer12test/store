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
	getSessionToken: () => Promise<string | null>;
	getState: () => EmbeddedBootstrapState;
	subscribe: (listener: Listener) => () => void;
}

const HOST_STORAGE_KEY = "shopify-admin-host";
const SHOPIFY_APP_BRIDGE_POLL_INTERVAL_MS = 50;
const SHOPIFY_APP_BRIDGE_TIMEOUT_MS = 1_500;

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

function wait(ms: number) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

async function waitForShopifyGlobal() {
	if (isServer) {
		return undefined;
	}

	const deadline = Date.now() + SHOPIFY_APP_BRIDGE_TIMEOUT_MS;
	let shopify = getShopifyGlobal();

	while (!shopify?.idToken && Date.now() < deadline) {
		await wait(SHOPIFY_APP_BRIDGE_POLL_INTERVAL_MS);
		shopify = getShopifyGlobal();
	}

	return shopify;
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

function readUrlBootstrapState() {
	const searchParams = new URLSearchParams(window.location.search);
	const hostFromUrl = searchParams.get("host");

	return {
		fallbackToken: searchParams.get("id_token"),
		host: hostFromUrl ?? getPersistedHost(),
		hostFromUrl,
		isEmbedded: searchParams.get("embedded") === "1" || Boolean(hostFromUrl ?? getPersistedHost()),
		shop: searchParams.get("shop"),
	};
}

async function requestSessionToken({
	fallbackToken,
	isEmbedded,
}: {
	fallbackToken: string | null;
	isEmbedded: boolean;
}): Promise<Pick<EmbeddedBootstrapState, "sessionToken" | "source">> {
	let sessionToken = fallbackToken;
	let source: EmbeddedBootstrapSource = sessionToken ? "url" : "none";

	if (!isEmbedded) {
		return {
			sessionToken,
			source,
		};
	}

	const shopify = await waitForShopifyGlobal();

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

	return {
		sessionToken,
		source,
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

		if (state.status === "ready" && (!state.isEmbedded || state.sessionToken)) {
			return state;
		}

		if (bootPromise) {
			return bootPromise;
		}

		bootPromise = (async () => {
			const bootstrapState = readUrlBootstrapState();

			if (bootstrapState.hostFromUrl) {
				persistHost(bootstrapState.hostFromUrl);
			}

			setState({
				...state,
				error: null,
				host: bootstrapState.host,
				isEmbedded: bootstrapState.isEmbedded,
				sessionToken: null,
				shop: bootstrapState.shop,
				source: "none",
				status: "booting",
			});

			const tokenState = await requestSessionToken({
				fallbackToken: bootstrapState.fallbackToken,
				isEmbedded: bootstrapState.isEmbedded,
			});

			const readyState: EmbeddedBootstrapState = {
				apiKey: getOptionalShopifyApiKey() ?? null,
				error: null,
				host: bootstrapState.host,
				isEmbedded: bootstrapState.isEmbedded,
				sessionToken: tokenState.sessionToken,
				shop: bootstrapState.shop,
				source: tokenState.source,
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

	const getSessionToken = async () => {
		if (isServer) {
			return null;
		}

		const readyState = await ensureReady();

		if (!readyState.isEmbedded) {
			return null;
		}

		const bootstrapState = readUrlBootstrapState();

		if (bootstrapState.hostFromUrl) {
			persistHost(bootstrapState.hostFromUrl);
		}

		const tokenState = await requestSessionToken({
			fallbackToken: bootstrapState.fallbackToken,
			isEmbedded: readyState.isEmbedded,
		});
		const nextState: EmbeddedBootstrapState = {
			...readyState,
			error: null,
			host: bootstrapState.host,
			sessionToken: tokenState.sessionToken,
			shop: bootstrapState.shop,
			source: tokenState.source,
			status: "ready",
		};

		setState(nextState);

		return tokenState.sessionToken;
	};

	return {
		ensureReady,
		getSessionToken,
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
