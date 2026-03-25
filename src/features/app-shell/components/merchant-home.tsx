import { Panel } from "@/components/ui/layout";
import {
	MerchantApprovalCards,
	MerchantDashboard,
	MerchantWorkflowCards,
} from "@/features/app-shell/components/merchant-workspace-ui";
import type { MerchantOverviewData } from "@/shared/contracts/merchant-workspace";

export function MerchantHome({ overview }: { overview: MerchantOverviewData }) {
	return (
		<div className="grid gap-5">
			<Panel
				description="Deterministic dashboard cards render directly from the validated merchant dashboard schema. No raw model HTML is used anywhere in this surface."
				title="Merchant operating dashboard"
			>
				<MerchantDashboard dashboard={overview.dashboard} />
			</Panel>

			<div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
				<Panel
					description="Every proposed Shopify mutation stays here until a merchant explicitly approves or rejects it."
					title="Pending approvals"
				>
					<MerchantApprovalCards
						approvals={overview.pendingApprovals}
						emptyBody="The copilot has not prepared any pending write actions for this shop yet."
						emptyTitle="No approvals waiting"
					/>
				</Panel>

				<Panel
					description="Background cache refreshes, re-index work, and regeneration jobs stay visible even when the copilot is idle."
					title="Recent workflows"
				>
					<MerchantWorkflowCards
						emptyBody="No merchant workflows have been queued for this shop yet."
						emptyTitle="No workflow activity"
						records={overview.recentWorkflows}
					/>
				</Panel>
			</div>
		</div>
	);
}
