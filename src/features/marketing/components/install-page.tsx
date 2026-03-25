import { StatusPill } from "@/components/ui/feedback";
import { PageHeader, Panel } from "@/components/ui/layout";
import { useSessionEnvelope } from "@/features/auth/session/client";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";
import {
	getOptionalConvexDeploymentUrl,
	getOptionalConvexHttpUrl,
	getOptionalShopifyApiKey,
	isInternalToolsEnabled,
} from "@/lib/env";

const checklistItems = [
	"Shopify app API key available to the frontend shell",
	"Shopify app secret available to the backend for token verification",
	"Shopify app URL set to https://storeai.ldev.cloud and managed-install scopes deployed",
	"Backend install/token-exchange flow writing a real shop record into Convex",
	"Webhook topics writing real deliveries into Convex",
	"Theme app extension generated and ready to activate from the live theme editor",
];

export function InstallPage() {
	const embeddedApp = useEmbeddedAppBootstrap();
	const session = useSessionEnvelope();
	const hasConvexDeploymentUrl = Boolean(getOptionalConvexDeploymentUrl());
	const hasConvexHttpUrl = Boolean(getOptionalConvexHttpUrl());
	const hasShopifyApiKey = Boolean(getOptionalShopifyApiKey());
	const internalToolsEnabled = isInternalToolsEnabled();

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
						<div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
							<div className="flex items-center gap-3">
								<StatusPill tone={hasConvexDeploymentUrl ? "success" : "blocked"}>
									{hasConvexDeploymentUrl
										? "Convex deployment URL set"
										: "Convex deployment URL missing"}
								</StatusPill>
								<StatusPill tone={hasConvexHttpUrl ? "success" : "blocked"}>
									{hasConvexHttpUrl ? "Convex HTTP URL ready" : "Convex HTTP URL missing"}
								</StatusPill>
							</div>
							<p className="mt-3 text-sm leading-6 text-slate-600">
								`VITE_CONVEX_URL` powers the client query shell. `VITE_CONVEX_SITE_URL` is an
								optional override for server-side HTTP action proxies and otherwise derives from the
								deployment URL.
							</p>
						</div>
						<div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
							<div className="flex items-center gap-3">
								<StatusPill tone={hasShopifyApiKey ? "success" : "blocked"}>
									{hasShopifyApiKey ? "Shopify API key set" : "Shopify API key missing"}
								</StatusPill>
							</div>
							<p className="mt-3 text-sm leading-6 text-slate-600">
								`SHOPIFY_API_KEY`{" "}
								{hasShopifyApiKey
									? "is available to the frontend shell."
									: "is not available to the frontend shell."}
							</p>
						</div>
						<div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
							<div className="flex items-center gap-3">
								<StatusPill tone={embeddedApp.host ? "success" : "watch"}>
									{embeddedApp.host ? "Embedded host detected" : "No embedded host"}
								</StatusPill>
								<StatusPill tone={embeddedApp.sessionToken ? "success" : "watch"}>
									{embeddedApp.sessionToken ? "Session token present" : "No session token"}
								</StatusPill>
							</div>
							<p className="mt-3 text-sm leading-6 text-slate-600">
								These values only appear when the shell is loaded by Shopify admin with real embed
								parameters.
							</p>
						</div>
						<div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
							<div className="flex items-center gap-3">
								<StatusPill
									tone={
										session.authMode === "embedded" && session.state === "ready"
											? "success"
											: "watch"
									}
								>
									{session.authMode === "embedded" && session.state === "ready"
										? "Convex bootstrap complete"
										: "Convex bootstrap pending"}
								</StatusPill>
								{session.activeShop ? (
									<StatusPill tone="neutral">{session.activeShop.domain}</StatusPill>
								) : null}
							</div>
							<p className="mt-3 text-sm leading-6 text-slate-600">
								{session.activeShop
									? `The current embedded session resolved the active shop as ${session.activeShop.name}.`
									: "The app shell has not resolved an embedded shop context yet."}
							</p>
						</div>
						<div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3">
							<div className="flex items-center gap-3">
								<StatusPill tone={internalToolsEnabled ? "accent" : "neutral"}>
									{internalToolsEnabled ? "Internal tools enabled" : "Internal tools disabled"}
								</StatusPill>
							</div>
							<p className="mt-3 text-sm leading-6 text-slate-600">
								The `/internal` console only exists for development/staff diagnostics.
							</p>
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
								className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900"
								key={item}
							>
								{item}
							</li>
						))}
					</ol>
					<p className="mt-6 text-sm leading-6 text-slate-600">
						No preview sessions, no mocked install flows, and no fabricated shop state remain on
						this page.
					</p>
				</Panel>
			</section>
		</div>
	);
}
