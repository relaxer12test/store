import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { MarketingLandingPage } from "@/features/marketing/components/landing-page";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(convexQuery(api.appShell.marketingSnapshot, {}));
	},
	component: LandingRoute,
});

function LandingRoute() {
	const { data } = useSuspenseQuery(convexQuery(api.appShell.marketingSnapshot, {}));

	return <MarketingLandingPage snapshot={data} />;
}
