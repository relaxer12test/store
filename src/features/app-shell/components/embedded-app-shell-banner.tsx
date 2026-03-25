import { StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";

export function EmbeddedAppShellBanner() {
	const embeddedApp = useEmbeddedAppBootstrap();

	const description = embeddedApp.isEmbedded
		? embeddedApp.sessionToken
			? "The shell captured a Shopify session token from the initial embedded load. Future protected requests can reuse the shared request helper instead of forcing document redirects."
			: "The shell is running inside Shopify admin. Request helpers are already bootstrapped so App Bridge token acquisition can be swapped in without rewriting routes or feature components."
		: "This route still renders as a local preview without an auth redirect. Inside Shopify admin, the same shell will bootstrap request headers and keep client navigation smooth.";

	return (
		<Panel
			description={description}
			title={embeddedApp.isEmbedded ? "Embedded bootstrap" : "Local preview bootstrap"}
		>
			<div className="flex flex-wrap gap-2">
				<StatusPill tone={embeddedApp.status === "error" ? "blocked" : "accent"}>
					{embeddedApp.status === "error" ? "Bootstrap error" : "Shell ready"}
				</StatusPill>
				<StatusPill tone={embeddedApp.isEmbedded ? "success" : "neutral"}>
					{embeddedApp.isEmbedded ? "Embedded admin" : "Local preview"}
				</StatusPill>
				<StatusPill tone={embeddedApp.sessionToken ? "success" : "watch"}>
					{embeddedApp.sessionToken ? "Session token detected" : "Token handoff deferred"}
				</StatusPill>
				{embeddedApp.shop ? <StatusPill tone="neutral">{embeddedApp.shop}</StatusPill> : null}
				{embeddedApp.host ? <StatusPill tone="neutral">host set</StatusPill> : null}
			</div>
		</Panel>
	);
}
