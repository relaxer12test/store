import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { AppProviders } from "@/integrations/app/providers";
import type { AppRouterContext } from "@/integrations/app/router-context";
import { currentViewerQuery } from "@/lib/auth-queries";
import { getAuthBootstrap } from "@/lib/auth-functions";
import { applyEmbeddedAppContentSecurityPolicyHeader } from "@/lib/auth-server";
import { getOptionalShopifyApiKey } from "@/lib/env";
import type { AppViewerContext } from "@/shared/contracts/auth";
import appCss from "@/styles.css?url";

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
	viewer,
}: {
	searchStr: string;
	viewer: AppViewerContext | null;
}): ShopifyAppBridgeDocumentConfig {
	const apiKey = getOptionalShopifyApiKey() ?? null;
	const searchParams = new URLSearchParams(searchStr);
	const host = searchParams.get("host");
	const shop =
		normalizeMyshopifyDomain(searchParams.get("shop")) ??
		normalizeMyshopifyDomain(viewer?.activeShop?.domain ?? null);
	const isEmbeddedRequest =
		viewer?.authMode === "embedded" ||
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

export const Route = createRootRouteWithContext<AppRouterContext>()({
	beforeLoad: async ({ context, location }) => {
		const auth = await getAuthBootstrap();

		if (typeof window === "undefined") {
			await applyEmbeddedAppContentSecurityPolicyHeader();
		}

		context.queryClient.setQueryData(currentViewerQuery.queryKey, auth.viewer);

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
			token: auth.token,
			viewer: auth.viewer,
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
			</head>
			<body className="antialiased">
				<AppProviders
					convexQueryClient={context.convexQueryClient}
					embeddedApp={context.embeddedApp}
					initialToken={context.token}
					queryClient={context.queryClient}
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
