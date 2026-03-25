import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { getSessionEnvelope } from "@/features/auth/session/server";
import { GlobalChrome } from "@/features/shell/components/global-chrome";
import { AppProviders } from "@/integrations/app/providers";
import type { AppRouterContext } from "@/integrations/app/router-context";
import { getOptionalShopifyApiKey } from "@/lib/env";
import appCss from "../styles.css?url";

const shopifyApiKey = getOptionalShopifyApiKey();

export const Route = createRootRouteWithContext<AppRouterContext>()({
	beforeLoad: async ({ context }) => {
		const session = await getSessionEnvelope();
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
			</head>
			<body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
				<AppProviders
					convexQueryClient={context.convexQueryClient}
					embeddedApp={context.embeddedApp}
					queryClient={context.queryClient}
				>
					<div className="min-h-screen">
						<GlobalChrome session={context.session} />
						<main>{children}</main>
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
					</div>
				</AppProviders>
				<Scripts />
			</body>
		</html>
	);
}
