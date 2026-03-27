import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Text } from "@/components/ui/cata/text";
import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import { api } from "@/lib/convex-api";

const snapshotQuery = convexQuery(api.systemStatus.snapshot, {});

export const Route = createFileRoute("/_chrome/internal/action-audits")({
	component: InternalActionAuditsRoute,
});

function InternalActionAuditsRoute() {
	const { data, error, isPending } = useQuery(snapshotQuery);

	if (isPending) {
		return <Text>Loading action audits…</Text>;
	}

	if (error || !data) {
		return (
			<Text className="text-red-600 dark:text-red-500">Failed to load action audits.</Text>
		);
	}

	return (
		<InternalModulePage
			description="Audit log rows that have really been written to Convex."
			emptyBody="No merchant action audit rows exist yet."
			emptyTitle="No action audits"
			records={data.auditLogs}
			title="Action audits"
		/>
	)
}
