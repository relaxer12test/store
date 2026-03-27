import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	ScriptOnce,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { AppProviders } from "@/integrations/app/providers";
import type { AppRouterContext } from "@/integrations/app/router-context";
import { resolveRequestSessionEnvelope } from "@/lib/auth-server";
import { getOptionalShopifyApiKey, isServer } from "@/lib/env";
import type { SessionEnvelope } from "@/shared/contracts/session";
import appCss from "@/styles.css?url";

const INITIAL_SESSION_WINDOW_KEY = "__GC_INITIAL_SESSION__";

interface ShopifyAppBridgeDocumentConfig {
	apiKey: string | null;
	host: string | null;
	shop: string | null;
	shouldLoad: boolean;
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
	session,
}: {
	searchStr: string;
	session: SessionEnvelope;
}): ShopifyAppBridgeDocumentConfig {
	const apiKey = getOptionalShopifyApiKey() ?? null;
	const searchParams = new URLSearchParams(searchStr);
	const host = searchParams.get("host");
	const shop =
		normalizeMyshopifyDomain(searchParams.get("shop")) ??
		normalizeMyshopifyDomain(session.activeShop?.domain ?? null);
	const isEmbeddedRequest =
		session.authMode === "embedded" ||
		searchParams.get("embedded") === "1" ||
		Boolean(host) ||
		Boolean(shop);

	return {
		apiKey,
		host,
		shop,
		shouldLoad: Boolean(apiKey && isEmbeddedRequest && shop),
	};
}

function serializeInlineScript(value: unknown) {
	return JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
	beforeLoad: async ({ context, location }) => {
		const currentSession = context.sessionManager.getState();
		const session = isServer ? await resolveRequestSessionEnvelope() : currentSession;
		context.setSession(session);

		return {
			activeShop: session.activeShop,
			roles: session.roles,
			session,
			shopifyAppBridge: resolveShopifyAppBridgeDocumentConfig({
				searchStr: location.searchStr,
				session,
			}),
			viewer: session.viewer,
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
				title: "Growth Capital Shopify AI",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
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
				<ScriptOnce
					children={`window.${INITIAL_SESSION_WINDOW_KEY} = ${serializeInlineScript(context.session)};`}
				/>
			</head>
			<body className="antialiased">
				<AppProviders
					convexQueryClient={context.convexQueryClient}
					embeddedApp={context.embeddedApp}
					queryClient={context.queryClient}
					sessionManager={context.sessionManager}
				>
					{children}
					<TanStackDevtools
						config={{
							position: "bottom-right",
						}}
						plugins={[
							{
								name: "TanStack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
				</AppProviders>
				<Scripts />
			</body>
		</html>
	);
}
