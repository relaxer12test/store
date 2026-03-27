import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";
import { useAppAuth } from "@/lib/auth-client";

export function MerchantAccessState() {
	const auth = useAppAuth();
	const embeddedApp = useEmbeddedAppBootstrap();
	const statusLabel = auth.isPending
		? "Resolving auth"
		: embeddedApp.isEmbedded
			? "Awaiting merchant bootstrap"
			: "Local development shell";
	const body = auth.isPending
		? "The app is checking the current Better Auth session and merchant viewer context."
		: embeddedApp.isEmbedded
			? "Protected merchant data loads after App Bridge supplies a fresh session token and the backend establishes a merchant browser session on the app host."
			: "This route is running outside Shopify admin. The shell stays visible, but protected merchant data stays unavailable until the app is opened as an embedded Shopify app.";

	return (
		<Panel
			description="Merchant reads are protected by Shopify session verification and shop-scoped Convex auth."
			title="Embedded access required"
		>
			<div className="space-y-4">
				<StatusPill tone={auth.isPending ? "accent" : "watch"}>{statusLabel}</StatusPill>
				<EmptyState body={body} title="Protected merchant data is not ready yet" />
			</div>
		</Panel>
	);
}
