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
import { getSessionEnvelope } from "@/lib/auth-server";
import { getOptionalShopifyApiKey, isServer } from "@/lib/env";
import appCss from "@/styles.css?url";

const shopifyApiKey = getOptionalShopifyApiKey();
const INITIAL_SESSION_WINDOW_KEY = "__GC_INITIAL_SESSION__";

function serializeInlineScript(value: unknown) {
	return JSON.stringify(value)
		.replace(/</g, "\\u003c")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
	beforeLoad: async ({ context }) => {
		const currentSession = context.sessionManager.getState();
		const session =
			isServer || currentSession.authMode === "none" ? await getSessionEnvelope() : currentSession;
		context.setSession(session);

		return {
			activeShop: session.activeShop,
			roles: session.roles,
			session,
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
			...(shopifyApiKey
				? [
						{
							name: "shopify-api-key",
							content: shopifyApiKey,
						},
					]
				: []),
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

	return (
		<html lang="en">
			<head>
				<HeadContent />
				<ScriptOnce
					children={`window.${INITIAL_SESSION_WINDOW_KEY} = ${serializeInlineScript(context.session)};`}
				/>
				{shopifyApiKey ? <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" /> : null}
			</head>
			<body className="antialiased">
				<AppProviders
					convexQueryClient={context.convexQueryClient}
					embeddedApp={context.embeddedApp}
					enableEmbeddedSessionBootstrap={context.sessionApi.enableEmbeddedSessionBootstrap}
					ensureEmbeddedSession={context.sessionApi.ensureEmbeddedSession}
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
