import { StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";

export function EmbeddedAppShellBanner() {
	const embeddedApp = useEmbeddedAppBootstrap();

	const description = embeddedApp.isEmbedded
		? embeddedApp.sessionToken
			? "The shell has a fresh Shopify session token from App Bridge. Merchant bootstrap can now establish the browser session on the app host without direct browser auth traffic to Convex."
			: "The shell is inside Shopify admin and is waiting for a fresh App Bridge session token before merchant bootstrap begins."
		: "This route renders as a local development shell outside Shopify admin. Inside Shopify admin, the same shell bootstraps merchant auth without route rewrites or cross-domain client cookie shims.";

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
