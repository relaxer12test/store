import { Link, Navigate } from "@tanstack/react-router";
import { Heading } from "@/components/ui/cata/heading";
import { Strong, Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";
import { useEmbeddedAppBootstrap } from "@/integrations/app/embedded";
import { useAppAuth } from "@/lib/auth-client";

export function LandingPage() {
	const auth = useAppAuth();
	const embeddedApp = useEmbeddedAppBootstrap();

	if (embeddedApp.isEmbedded && auth.isMerchant) {
		return <Navigate replace to="/app" />;
	}

	return (
		<div className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24">
			<div className="flex flex-wrap items-center gap-3">
				<StatusPill tone={auth.hasSession ? "success" : "watch"}>
					{auth.hasSession ? "Better Auth session ready" : "No browser session"}
				</StatusPill>
				{auth.viewer?.activeShop ? (
					<StatusPill tone="success">Shop connected</StatusPill>
				) : (
					<StatusPill tone="neutral">No shop connected</StatusPill>
				)}
			</div>

			<Heading level={1} className="mt-8">
				Shopify AI Console
			</Heading>
			<Text className="mt-3 max-w-lg">
				Embedded admin shell on `storeai.ldev.cloud` with real Shopify bootstrap, webhook ingestion,
				diagnostics, and a live storefront app embed path for the shopper widget.
			</Text>

			<nav className="mt-10 grid gap-4 sm:grid-cols-2">
				<Link
					className="group flex flex-col gap-2 rounded-lg border border-zinc-950/5 bg-white px-6 py-5 transition hover:border-zinc-300 hover:shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20"
					to="/app"
				>
					<Strong>Merchant app</Strong>
					<Text>Embedded Shopify admin surface</Text>
				</Link>

				<Link
					className="group flex flex-col gap-2 rounded-lg border border-zinc-950/5 bg-white px-6 py-5 transition hover:border-zinc-300 hover:shadow-sm dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20"
					to="/install"
				>
					<Strong>Install</Strong>
					<Text>Connection setup and checklist</Text>
				</Link>
			</nav>
		</div>
	);
}
