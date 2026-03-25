import { StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";

export function EmbeddedAppShellBanner() {
	const embeddedApp = useEmbeddedAppBootstrap();

	const description = embeddedApp.isEmbedded
		? embeddedApp.sessionToken
			? "The shell has a fresh Shopify session token from App Bridge. Protected backend calls can now ride the shared bearer-token request helper instead of forcing auth redirects or URL token parsing."
			: "The shell is inside Shopify admin and is waiting for a fresh App Bridge session token before protected backend requests begin."
		: "This route renders as a local development shell outside Shopify admin. Inside Shopify admin, the same shell bootstraps bearer-authenticated requests without resetting the SPA shell.";

	return (
		<Panel
			description={description}
			title={embeddedApp.isEmbedded ? "Embedded bootstrap" : "Local development shell"}
		>
			<div className="flex flex-wrap gap-2">
				<StatusPill tone={embeddedApp.status === "error" ? "blocked" : "accent"}>
					{embeddedApp.status === "error" ? "Bootstrap error" : "Shell ready"}
				</StatusPill>
				<StatusPill tone={embeddedApp.isEmbedded ? "success" : "neutral"}>
					{embeddedApp.isEmbedded ? "Embedded admin" : "Local development"}
				</StatusPill>
				<StatusPill tone={embeddedApp.sessionToken ? "success" : "watch"}>
					{embeddedApp.sessionToken ? "Bearer ready" : "Waiting for token"}
				</StatusPill>
				{embeddedApp.shop ? <StatusPill tone="neutral">{embeddedApp.shop}</StatusPill> : null}
				{embeddedApp.host ? <StatusPill tone="neutral">host set</StatusPill> : null}
			</div>
		</Panel>
	);
}
