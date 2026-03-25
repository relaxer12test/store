import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { useSessionEnvelope } from "@/features/auth/session/client";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";

export function MerchantAccessState() {
	const embeddedApp = useEmbeddedAppBootstrap();
	const session = useSessionEnvelope();
	const statusLabel =
		session.state === "offline"
			? "Bootstrap offline"
			: embeddedApp.isEmbedded
				? "Awaiting Shopify session"
				: "Local development shell";
	const body =
		session.state === "offline"
			? "Shopify session verification or Convex bootstrap failed for this embedded session. Refresh from Shopify admin to mint a new protected merchant token."
			: embeddedApp.isEmbedded
				? "Protected merchant data loads after App Bridge supplies a fresh session token and the backend resolves the current shop and merchant actor."
				: "This route is running outside Shopify admin. The shell stays visible, but protected merchant data stays unavailable until the app is opened as an embedded Shopify app.";

	return (
		<Panel
			description="Merchant reads are protected by Shopify session verification and shop-scoped Convex auth."
			title="Embedded access required"
		>
			<div className="space-y-4">
				<StatusPill tone={session.state === "offline" ? "blocked" : "watch"}>
					{statusLabel}
				</StatusPill>
				<EmptyState body={body} title="Protected merchant data is not ready yet" />
			</div>
		</Panel>
	);
}
