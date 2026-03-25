import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

export function MerchantSettingsPage({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<Panel
			description="Bootstrap now seeds a real shop-scoped widget configuration row. The remaining gap is a protected read/write settings surface for merchants."
			title="Settings"
		>
			<EmptyState
				body={
					snapshot.shops.length === 0
						? "No installed shop record exists yet, so there is nowhere to persist merchant settings."
						: "A shop record exists and bootstrap seeds widget defaults, but this page still needs a protected settings query and mutation flow."
				}
				title="Settings flow pending"
			/>
		</Panel>
	);
}
