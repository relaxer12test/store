import { Badge } from "@/components/ui/cata/badge";
import { Button } from "@/components/ui/cata/button";
import { Subheading } from "@/components/ui/cata/heading";
import { Strong, Text } from "@/components/ui/cata/text";
import type { MerchantApprovalCard } from "@/shared/contracts/merchant-workspace";

function approvalBadgeColor(status: MerchantApprovalCard["status"]) {
	switch (status) {
		case "approved":
			return "emerald" as const;
		case "executing":
		case "pending":
			return "amber" as const;
		case "failed":
			return "red" as const;
		case "rejected":
			return "zinc" as const;
	}
}

export function CopilotInlineApprovals({
	activeApprovalId,
	approvals,
	onApprove,
	onReject,
}: {
	activeApprovalId?: string | null;
	approvals: MerchantApprovalCard[];
	onApprove?: (approvalId: string) => void;
	onReject?: (approvalId: string) => void;
}) {
	if (approvals.length === 0) {
		return null;
	}

	return (
		<div className="mt-4 space-y-3">
			{approvals.map((approval) => {
				const isBusy = activeApprovalId === approval.id;

				return (
					<div
						className="rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/5 dark:bg-zinc-900"
						key={approval.id}
					>
						<div className="flex items-start justify-between gap-3">
							<Subheading className="text-sm">{approval.summary}</Subheading>
							<Badge color={approvalBadgeColor(approval.status)}>{approval.status}</Badge>
						</div>

						<Text className="mt-1 text-xs">
							{approval.targetShopDomain} via {approval.tool}
						</Text>

						<Text className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
							{approval.riskSummary}
						</Text>

						{approval.plannedChanges.length > 0 ? (
							<dl className="mt-3 space-y-1">
								{approval.plannedChanges.map((change) => (
									<div className="text-xs leading-5" key={`${approval.id}-${change.label}`}>
										<Strong className="text-xs">{change.label}: </Strong>
										<span className="text-zinc-500 dark:text-zinc-400">
											{change.before ?? "n/a"}
										</span>
										<span className="mx-1.5 text-zinc-400 dark:text-zinc-500">&rarr;</span>
										<span className="text-zinc-900 dark:text-zinc-100">
											{change.after ?? "n/a"}
										</span>
									</div>
								))}
							</dl>
						) : null}

						{approval.resultSummary ? (
							<p className="mt-3 text-xs leading-5 text-emerald-700 dark:text-emerald-400">
								{approval.resultSummary}
							</p>
						) : null}

						{approval.errorMessage ? (
							<p className="mt-3 text-xs leading-5 text-rose-700 dark:text-rose-400">
								{approval.errorMessage}
							</p>
						) : null}

						{approval.status === "pending" && (onApprove || onReject) ? (
							<div className="mt-3 flex gap-2">
								{onApprove ? (
									<Button
										className="text-xs"
										color="emerald"
										disabled={isBusy}
										onClick={() => onApprove(approval.id)}
										type="button"
									>
										{isBusy ? "Applying..." : "Approve"}
									</Button>
								) : null}
								{onReject ? (
									<Button
										className="text-xs"
										disabled={isBusy}
										onClick={() => onReject(approval.id)}
										outline
										type="button"
									>
										Reject
									</Button>
								) : null}
							</div>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
