import { EmptyState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

export function MerchantSettingsPage({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	return (
		<Panel
			description="Settings should be backed by a real shop-scoped config table and authenticated mutations. There is no fake local settings form here anymore."
			title="Settings"
		>
			<EmptyState
				body={
					snapshot.shops.length === 0
						? "No installed shop record exists yet, so there is nowhere to persist merchant settings."
						: "A shop record exists, but there is still no real widget-config/settings table or authenticated mutation flow."
				}
				title="Settings not connected"
			/>
		</Panel>
	);
}
