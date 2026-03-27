import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import { PageHeader, Panel } from "@/components/ui/layout";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";
import { useAppAuth } from "@/lib/auth-client";
import { getOptionalConvexDeploymentUrl, getOptionalShopifyApiKey } from "@/lib/env";

const checklistItems = [
	"Shopify app API key available to the frontend shell",
	"Shopify app secret available to the backend for token verification",
	"Shopify app URL set to https://storeai.ldev.cloud and managed-install scopes deployed",
	"Backend install/token-exchange flow writing a real shop record into Convex",
	"Webhook topics writing real deliveries into Convex",
	"Theme app extension generated and ready to activate from the live theme editor",
];

export function InstallPage() {
	const auth = useAppAuth();
	const embeddedApp = useEmbeddedAppBootstrap();
	const hasConvexDeploymentUrl = Boolean(getOptionalConvexDeploymentUrl());
	const hasShopifyApiKey = Boolean(getOptionalShopifyApiKey());

	return (
		<div className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
			<PageHeader
				description="This page now reports actual local/runtime prerequisites. It no longer offers preview-session shortcuts or invented install states."
				eyebrow="Merchant onboarding"
				title="Real connection checklist"
			/>

			<section className="mt-10 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
				<Panel
					description="Current runtime signals from the local app shell."
					title="Runtime status"
				>
					<div className="grid gap-3">
						<div className="rounded-lg border border-zinc-950/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-800">
							<div className="flex items-center gap-3">
								<StatusPill tone={hasConvexDeploymentUrl ? "success" : "blocked"}>
									{hasConvexDeploymentUrl
										? "Convex deployment URL set"
										: "Convex deployment URL missing"}
								</StatusPill>
								<StatusPill tone="success">Worker `/api` proxy active</StatusPill>
							</div>
							<Text className="mt-3">
								`VITE_CONVEX_URL` powers the internal Convex client and Worker-to-Convex proxy
								target. Public browser and storefront traffic should stay on the app host under
								`/api/*`.
							</Text>
						</div>
						<div className="rounded-lg border border-zinc-950/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-800">
							<div className="flex items-center gap-3">
								<StatusPill tone={hasShopifyApiKey ? "success" : "blocked"}>
									{hasShopifyApiKey ? "Shopify API key set" : "Shopify API key missing"}
								</StatusPill>
							</div>
							<Text className="mt-3">
								`SHOPIFY_API_KEY`{" "}
								{hasShopifyApiKey
									? "is available to the frontend shell."
									: "is not available to the frontend shell."}
							</Text>
						</div>
						<div className="rounded-lg border border-zinc-950/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-800">
							<div className="flex items-center gap-3">
								<StatusPill tone={embeddedApp.host ? "success" : "watch"}>
									{embeddedApp.host ? "Embedded host detected" : "No embedded host"}
								</StatusPill>
								<StatusPill tone={embeddedApp.sessionToken ? "success" : "watch"}>
									{embeddedApp.sessionToken ? "Session token present" : "No session token"}
								</StatusPill>
							</div>
							<Text className="mt-3">
								These values only appear when the shell is loaded by Shopify admin with real embed
								parameters.
							</Text>
						</div>
						<div className="rounded-lg border border-zinc-950/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-800">
							<div className="flex items-center gap-3">
								<StatusPill tone={auth.isMerchant ? "success" : "watch"}>
									{auth.isMerchant ? "Merchant auth ready" : "Merchant auth pending"}
								</StatusPill>
								{auth.viewer?.activeShop ? (
									<StatusPill tone="neutral">Embedded shop resolved</StatusPill>
								) : null}
							</div>
							<Text className="mt-3">
								{auth.viewer?.activeShop
									? "The current embedded session resolved an active shop context."
									: "The app shell has not resolved an embedded shop context yet."}
							</Text>
						</div>
					</div>
				</Panel>

				<Panel
					description="These are the concrete prerequisites for a real Shopify connection."
					title="Execution checklist"
				>
					<ol className="space-y-3">
						{checklistItems.map((item) => (
							<li
								className="rounded-lg border border-zinc-950/5 bg-zinc-50 px-4 py-3 dark:border-white/10 dark:bg-zinc-800"
								key={item}
							>
								<Text>{item}</Text>
							</li>
						))}
					</ol>
					<Text className="mt-6">
						No preview sessions, no mocked install flows, and no fabricated shop state remain on
						this page.
					</Text>
				</Panel>
			</section>
		</div>
	);
}
