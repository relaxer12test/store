import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

export function MerchantCopilotPage({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<Panel
			description="The merchant copilot should only appear once real shop data, tools, and audit logging are connected. There is no fabricated chat transcript here anymore."
			title="Merchant copilot"
		>
			<EmptyState
				body={
					snapshot.shops.length === 0
						? "No connected shop record exists yet, so there is nothing trustworthy for a copilot to answer from."
						: "A shop record exists, but there is still no real AI toolchain or audit-backed merchant action flow wired."
				}
				title="Copilot not connected"
			/>
		</Panel>
	);
}
