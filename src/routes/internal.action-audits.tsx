import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/internal/action-audits")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(snapshotQuery);
	},
	component: InternalActionAuditsRoute,
});

function InternalActionAuditsRoute() {
	const { data } = useSuspenseQuery(snapshotQuery);

	return (
		<InternalModulePage
			description="Audit log rows that have really been written to Convex."
			emptyBody="No merchant action audit rows exist yet."
			emptyTitle="No action audits"
			records={data.auditLogs}
			title="Action audits"
		/>
	);
}
