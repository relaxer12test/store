import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InstallPreviewPage } from "@/features/marketing/components/install-page";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/install")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(convexQuery(api.appShell.installGuide, {}));
	},
	component: InstallRoute,
});

function InstallRoute() {
	const { data } = useSuspenseQuery(convexQuery(api.appShell.installGuide, {}));
	const { session } = Route.useRouteContext();

	return <InstallPreviewPage guide={data} session={session} />;
}
