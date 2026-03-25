import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/internal/cache")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(
			convexQuery(api.appShell.internalModule, { module: "cache" }),
		);
	},
	component: InternalCacheRoute,
});

function InternalCacheRoute() {
	const { data } = useSuspenseQuery(convexQuery(api.appShell.internalModule, { module: "cache" }));

	return <InternalModulePage snapshot={data} />;
}
