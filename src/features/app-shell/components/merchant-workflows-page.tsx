import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

export function MerchantWorkflowsPage({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<InternalModulePage
			description="Real sync job rows currently stored in Convex."
			emptyBody="No sync jobs exist yet, so workflows are not connected to Shopify activity."
			emptyTitle="No workflows"
			records={snapshot.syncJobs}
			title="Workflows"
		/>
	);
}
