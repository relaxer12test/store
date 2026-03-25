import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

export function MerchantExplorerPage({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<Panel
			description="Explorer should only show real mirrored catalog and operations data. There is no fake product grid here anymore."
			title="Explorer"
		>
			<EmptyState
				body={
					snapshot.syncJobs.length > 0
						? "Workflow records exist, but there are still no real product, variant, inventory, or order mirror tables to explore."
						: "No warehouse mirror tables exist yet, so there is nothing real to explore."
				}
				title="Explorer not connected"
			/>
		</Panel>
	);
}
