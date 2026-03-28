import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
	useRouter,
	useRouterState,
	type ErrorComponentProps,
	type NotFoundRouteProps,
} from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/cata/button";
import { Heading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import { AppProviders } from "@/integrations/app/providers";
import type { AppRouterContext } from "@/integrations/app/router-context";
import { getAuthBootstrap } from "@/lib/auth-functions";
import { currentViewerQuery } from "@/lib/auth-queries";
import { applyEmbeddedAppContentSecurityPolicyHeader } from "@/lib/auth-server";
import { getOptionalShopifyApiKey } from "@/lib/env";
import type { AppViewerContext } from "@/shared/contracts/auth";
import appCss from "@/styles.css?url";

const ROUTER_LOG_PREFIX = "[router]";
const authBootstrapTokenQueryKey = ["rootAuthBootstrapToken"] as const;

interface ShopifyAppBridgeDocumentConfig {
	apiKey: string | null;
	host: string | null;
	shop: string | null;
	shouldLoad: boolean;
}

interface RouterDiagnosticsSnapshot {
	hash: string;
	href: string;
	matches: Array<{
		fullPath: string;
		pathname: string;
		routeId: string;
		status: string;
	}>;
	pathname: string;
	search: string;
	status: string;
}

function normalizeMyshopifyDomain(value: string | null) {
	const trimmed = value?.trim().toLowerCase();

	if (!trimmed || !/^[a-z0-9-]+\.myshopify\.com$/.test(trimmed)) {
		return null;
	}

	return trimmed;
}

function resolveShopifyAppBridgeDocumentConfig({
	searchStr,
	viewer,
}: {
	searchStr: string;
	viewer: AppViewerContext | null;
}): ShopifyAppBridgeDocumentConfig {
	const apiKey = getOptionalShopifyApiKey() ?? null;
	const searchParams = new URLSearchParams(searchStr);
	const host = searchParams.get("host");
	const explicitShop = normalizeMyshopifyDomain(searchParams.get("shop"));
	const shop = explicitShop ?? normalizeMyshopifyDomain(viewer?.activeShop?.domain ?? null);
	const hasExplicitEmbeddedSignal =
		searchParams.get("embedded") === "1" || Boolean(host) || Boolean(explicitShop);
	const isEmbeddedViewer = viewer?.authMode === "embedded" && !viewer?.roles.includes("admin");
	const isEmbeddedRequest = isEmbeddedViewer || hasExplicitEmbeddedSignal;

	return {
		apiKey,
		host,
		shop,
		shouldLoad: Boolean(apiKey && isEmbeddedRequest),
	};
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
	beforeLoad: async ({ context, location }) => {
		if (typeof window === "undefined") {
			const auth = await getAuthBootstrap();

			await applyEmbeddedAppContentSecurityPolicyHeader();

			context.queryClient.setQueryData(currentViewerQuery.queryKey, auth.viewer);
			context.queryClient.setQueryData(authBootstrapTokenQueryKey, auth.token ?? null);

			if (auth.token) {
				context.convexQueryClient.serverHttpClient?.setAuth(auth.token);
			} else {
				context.convexQueryClient.serverHttpClient?.clearAuth();
			}

			return {
				shopifyAppBridge: resolveShopifyAppBridgeDocumentConfig({
					searchStr: location.searchStr,
					viewer: auth.viewer,
				}),
				token: auth.token ?? null,
				viewer: auth.viewer,
			};
		}

		const viewer =
			(context.queryClient.getQueryData(currentViewerQuery.queryKey) as
				| AppViewerContext
				| null
				| undefined) ?? null;
		const token =
			(context.queryClient.getQueryData(authBootstrapTokenQueryKey) as string | null | undefined) ??
			null;

		return {
			shopifyAppBridge: resolveShopifyAppBridgeDocumentConfig({
				searchStr: location.searchStr,
				viewer,
			}),
			token,
			viewer,
		};
	},
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				name: "theme-color",
				content: "#8B5CF6",
			},
			{
				title: "Moonbeam",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
			{
				rel: "icon",
				href: "/icon-moonbeam.svg",
				type: "image/svg+xml",
			},
			{
				rel: "icon",
				href: "/favicon.ico",
				type: "image/x-icon",
			},
			{
				rel: "apple-touch-icon",
				href: "/logo192.png",
			},
			{
				rel: "manifest",
				href: "/manifest.json",
			},
		],
	}),
	errorComponent: RouterErrorBoundary,
	notFoundComponent: RouterNotFoundBoundary,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	const context = Route.useRouteContext();
	const { shopifyAppBridge } = context;

	return (
		<html lang="en">
			<head>
				<HeadContent />
				{shopifyAppBridge.apiKey ? (
					<meta content={shopifyAppBridge.apiKey} name="shopify-api-key" />
				) : null}
				{shopifyAppBridge.host ? (
					<meta content={shopifyAppBridge.host} name="shopify-host" />
				) : null}
				{shopifyAppBridge.shop ? (
					<meta content={shopifyAppBridge.shop} name="shopify-shop" />
				) : null}
				{shopifyAppBridge.shouldLoad ? (
					<script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
				) : null}
			</head>
			<body className="antialiased">
				<AppProviders
					convexQueryClient={context.convexQueryClient}
					embeddedApp={context.embeddedApp}
					initialToken={context.token}
					queryClient={context.queryClient}
				>
					{children}
				</AppProviders>
				<Scripts />
			</body>
		</html>
	);
}

function useRouterDiagnosticsSnapshot(): RouterDiagnosticsSnapshot {
	return useRouterState({
		select: (state) => ({
			hash: state.location.hash,
			href: `${state.location.pathname}${state.location.searchStr}${state.location.hash}`,
			matches: state.matches.map((match) => ({
				fullPath: match.fullPath,
				pathname: match.pathname,
				routeId: match.routeId,
				status: match.status,
			})),
			pathname: state.location.pathname,
			search: state.location.searchStr,
			status: state.status,
		}),
	});
}

function serializeLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
	if (value instanceof Error) {
		const serialized: Record<string, unknown> = {
			message: value.message,
			name: value.name,
		};

		for (const propertyName of Object.getOwnPropertyNames(value)) {
			const propertyValue = Reflect.get(value, propertyName) as unknown;

			if (propertyValue !== undefined) {
				serialized[propertyName] = serializeLogValue(propertyValue, seen);
			}
		}

		return serialized;
	}

	if (Array.isArray(value)) {
		return value.map((item) => serializeLogValue(item, seen));
	}

	if (value && typeof value === "object") {
		if (seen.has(value)) {
			return "[circular]";
		}

		seen.add(value);

		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => [
				key,
				serializeLogValue(nestedValue, seen),
			]),
		);
	}

	if (typeof value === "function") {
		return `[function ${value.name || "anonymous"}]`;
	}

	if (typeof value === "symbol") {
		return value.toString();
	}

	return value;
}

function useLogRouterEvent(event: "not_found" | "route_error", payload: unknown) {
	const lastLogRef = useRef<string>("");

	useEffect(() => {
		const normalizedPayload = serializeLogValue(payload);
		const serializedPayload = JSON.stringify(normalizedPayload);

		if (serializedPayload === lastLogRef.current) {
			return;
		}

		lastLogRef.current = serializedPayload;

		if (event === "route_error") {
			console.error(`${ROUTER_LOG_PREFIX} ${event}`, normalizedPayload);
			return;
		}

		console.warn(`${ROUTER_LOG_PREFIX} ${event}`, normalizedPayload);
	}, [event, payload]);
}

function RouterErrorBoundary({ error, reset }: ErrorComponentProps) {
	const router = useRouter();
	const snapshot = useRouterDiagnosticsSnapshot();
	const boundaryRouteId = snapshot.matches.at(-1)?.routeId ?? "__root__";
	const errorMessage =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "Unknown route error.";

	useLogRouterEvent("route_error", {
		boundaryRouteId,
		error,
		location: {
			hash: snapshot.hash,
			href: snapshot.href,
			pathname: snapshot.pathname,
			search: snapshot.search,
		},
		matches: snapshot.matches,
		routerStatus: snapshot.status,
	});

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10 sm:px-6">
			<section className="w-full rounded-2xl border border-zinc-950/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900 sm:p-8">
				<StatusPill tone="blocked">Route error</StatusPill>
				<Heading className="mt-4">This route failed to load</Heading>
				<Text className="mt-2 max-w-2xl">
					The router caught an unexpected error while resolving this screen. Check the browser
					console for{" "}
					<span className="font-mono text-zinc-700 dark:text-zinc-300">
						{`${ROUTER_LOG_PREFIX} route_error`}
					</span>{" "}
					for the full payload.
				</Text>
				<div className="mt-6 flex flex-wrap gap-3">
					<Button
						color="dark/zinc"
						onClick={() => {
							reset();
							void router.invalidate();
						}}
					>
						Retry route
					</Button>
					<Button href="/" outline>
						Go home
					</Button>
				</div>
				<RouterDiagnosticsSummary
					boundaryRouteId={boundaryRouteId}
					message={errorMessage}
					snapshot={snapshot}
				/>
			</section>
		</main>
	);
}

function RouterNotFoundBoundary({ data, routeId }: NotFoundRouteProps) {
	const snapshot = useRouterDiagnosticsSnapshot();

	useLogRouterEvent("not_found", {
		boundaryRouteId: routeId,
		data,
		location: {
			hash: snapshot.hash,
			href: snapshot.href,
			pathname: snapshot.pathname,
			search: snapshot.search,
		},
		matches: snapshot.matches,
		routerStatus: snapshot.status,
	});

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10 sm:px-6">
			<section className="w-full rounded-2xl border border-zinc-950/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900 sm:p-8">
				<StatusPill tone="watch">Route not found</StatusPill>
				<Heading className="mt-4">No route matched this URL</Heading>
				<Text className="mt-2 max-w-2xl">
					The router resolved this request as not found. Check the browser console for{" "}
					<span className="font-mono text-zinc-700 dark:text-zinc-300">
						{`${ROUTER_LOG_PREFIX} not_found`}
					</span>{" "}
					to see the exact pathname, search string, and matched route chain.
				</Text>
				<div className="mt-6 flex flex-wrap gap-3">
					<Button color="dark/zinc" href="/">
						Go home
					</Button>
				</div>
				<RouterDiagnosticsSummary boundaryRouteId={routeId} snapshot={snapshot} />
			</section>
		</main>
	);
}

function RouterDiagnosticsSummary({
	boundaryRouteId,
	message,
	snapshot,
}: {
	boundaryRouteId: string;
	message?: string;
	snapshot: RouterDiagnosticsSnapshot;
}) {
	const activeMatches = snapshot.matches.length
		? snapshot.matches.map((match) => `${match.routeId}:${match.status}`).join(" -> ")
		: "none";

	return (
		<div className="mt-8 grid gap-4 sm:grid-cols-2">
			<RouterDiagnosticsField label="Path" value={snapshot.href || snapshot.pathname || "/"} />
			<RouterDiagnosticsField label="Boundary route" value={boundaryRouteId} />
			<RouterDiagnosticsField label="Router status" value={snapshot.status} />
			<RouterDiagnosticsField label="Search" value={snapshot.search || "(empty)"} />
			<div className="sm:col-span-2">
				<Text>Active matches</Text>
				<pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-950/10 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200">
					{activeMatches}
				</pre>
			</div>
			{message ? (
				<div className="sm:col-span-2">
					<Text>Error message</Text>
					<pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-950/10 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200">
						{message}
					</pre>
				</div>
			) : null}
		</div>
	);
}

function RouterDiagnosticsField({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<Text>{label}</Text>
			<pre className="mt-2 overflow-x-auto rounded-lg border border-zinc-950/10 bg-zinc-50 px-4 py-3 font-mono text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200">
				{value}
			</pre>
		</div>
	);
}
