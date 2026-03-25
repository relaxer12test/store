import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/internal/install-state")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: InternalInstallStateRoute,
});

function InternalInstallStateRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return (
		<InternalModulePage
			description="Actual shop installation records currently stored in Convex."
			emptyBody="No Shopify installation records exist in Convex yet."
			emptyTitle="No install records"
			records={data.shops}
			title="Install state"
		/>
	);
}
