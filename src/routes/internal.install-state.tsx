import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

export const Route = createFileRoute("/internal/install-state")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(
			convexQuery(api.appShell.internalModule, { module: "install-state" }),
		);
	},
	component: InternalInstallStateRoute,
});

function InternalInstallStateRoute() {
	const { data } = useSuspenseQuery(
		convexQuery(api.appShell.internalModule, { module: "install-state" }),
	);

	return <InternalModulePage snapshot={data} />;
}
