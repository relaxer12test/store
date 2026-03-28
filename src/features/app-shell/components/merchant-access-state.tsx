import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";
import { useAppAuth } from "@/lib/auth-client";

export function MerchantAccessState() {
	const auth = useAppAuth();
	const embeddedApp = useEmbeddedAppBootstrap();
	const statusLabel = auth.isPending
		? "Resolving auth"
		: auth.isAdmin
			? "Admin needs shop context"
			: embeddedApp.isEmbedded
				? "Awaiting merchant bootstrap"
				: "Local development shell";
	const body = auth.isPending
		? "Checking your session..."
		: auth.isAdmin
			? "This admin account does not currently resolve to an active merchant shop. Use an admin account linked to exactly one merchant membership or open the app from Shopify admin."
			: embeddedApp.isEmbedded
				? "Waiting for Shopify to provide access. This usually takes a moment."
				: "Open this app from your Shopify admin to access store data.";

	return (
		<Panel description="Requires an active Shopify session." title="Embedded access required">
			<div className="space-y-4">
				<StatusPill tone={auth.isPending ? "accent" : "watch"}>{statusLabel}</StatusPill>
				<EmptyState body={body} title="Protected merchant data is not ready yet" />
			</div>
		</Panel>
	);
}
