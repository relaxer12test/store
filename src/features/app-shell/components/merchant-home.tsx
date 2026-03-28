import { Panel } from "@/components/ui/layout";
import {
	MerchantApprovalCards,
	MerchantDashboard,
	MerchantWorkflowCards,
} from "@/features/app-shell/components/merchant-workspace-ui";
import type { MerchantOverviewData } from "@/shared/contracts/merchant-workspace";

export function MerchantHome({ overview }: { overview: MerchantOverviewData }) {
	return (
		<div className="grid gap-4">
			<Panel title="Dashboard">
				<MerchantDashboard dashboard={overview.dashboard} />
			</Panel>

			<div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
				<Panel description="Actions waiting for your review." title="Pending approvals">
					<MerchantApprovalCards
						approvals={overview.pendingApprovals}
						emptyBody="No pending actions. The copilot will suggest changes here."
						emptyTitle="No approvals waiting"
					/>
				</Panel>

				<Panel description="Recent background jobs and their status." title="Recent workflows">
					<MerchantWorkflowCards
						emptyBody="No recent workflow activity."
						emptyTitle="No workflow activity"
						records={overview.recentWorkflows}
					/>
				</Panel>
			</div>
		</div>
	);
}
