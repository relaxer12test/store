import { InternalModulePage } from "@/features/internal/components/internal-module-page";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

export function MerchantWorkflowsPage({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<InternalModulePage
			description="Real Shopify sync jobs, cache refreshes, reconciliation scans, and uninstall cleanup rows currently stored in Convex."
			emptyBody="No sync jobs exist yet, so Shopify-backed workflows are still idle."
			emptyTitle="No workflows"
			records={snapshot.syncJobs}
			title="Workflows"
		/>
	);
}
