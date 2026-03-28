import { Avatar } from "@/components/ui/cata/avatar";
import { Badge } from "@/components/ui/cata/badge";
import { Divider } from "@/components/ui/cata/divider";
import { CopilotInlineApprovals } from "@/features/app-shell/components/copilot/copilot-inline-approvals";
import { CopilotInlineCitations } from "@/features/app-shell/components/copilot/copilot-inline-citations";
import { CopilotInlineDashboard } from "@/features/app-shell/components/copilot/copilot-inline-dashboard";
import { cn } from "@/lib/cn";
import type { MerchantCopilotMessage } from "@/shared/contracts/merchant-workspace";

function formatTimestamp(value: string) {
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? new Date(parsed).toLocaleTimeString() : value;
}

export function UserMessage({ message }: { message: MerchantCopilotMessage }) {
	return (
		<div className="group flex justify-end">
			<div className="max-w-[85%]">
				<div className="rounded-2xl rounded-br-md bg-zinc-900 px-4 py-3 text-white dark:bg-zinc-100 dark:text-zinc-900">
					<p className="text-sm leading-6 whitespace-pre-wrap">{message.body}</p>
				</div>
				<p className="mt-1 text-right text-[0.65rem] text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500">
					{formatTimestamp(message.createdAt)}
				</p>
			</div>
		</div>
	);
}

export function AssistantMessage({
	activeApprovalId,
	message,
	onApprove,
	onReject,
}: {
	activeApprovalId?: string | null;
	message: MerchantCopilotMessage;
	onApprove?: (approvalId: string) => void;
	onReject?: (approvalId: string) => void;
}) {
	const hasDashboard = message.dashboard !== null;

	return (
		<div className="group flex items-start gap-3">
			<Avatar className={cn("size-6 shrink-0 bg-indigo-500 text-white")} initials="AI" />
			<div
				className={cn(
					"min-w-0 rounded-2xl rounded-bl-md border border-zinc-950/5 bg-zinc-50 px-4 py-3 dark:border-white/5 dark:bg-zinc-800/60",
					hasDashboard ? "max-w-full" : "max-w-[85%]",
				)}
			>
				{message.toolNames.length > 0 ? (
					<div className="mb-2 flex flex-wrap gap-1">
						{message.toolNames.map((toolName) => (
							<Badge className="text-[0.6rem]" color="zinc" key={toolName}>
								{toolName}
							</Badge>
						))}
					</div>
				) : null}

				<p className="text-sm leading-6 text-zinc-900 whitespace-pre-wrap dark:text-zinc-100">
					{message.body}
				</p>

				{message.dashboard ? (
					<>
						<div className="mt-4">
							<Divider soft />
						</div>
						<CopilotInlineDashboard dashboard={message.dashboard} />
					</>
				) : null}

				{message.approvals.length > 0 ? (
					<>
						<div className="mt-4">
							<Divider soft />
						</div>
						<CopilotInlineApprovals
							activeApprovalId={activeApprovalId}
							approvals={message.approvals}
							onApprove={onApprove}
							onReject={onReject}
						/>
					</>
				) : null}

				{message.citations.length > 0 ? (
					<CopilotInlineCitations citations={message.citations} />
				) : null}

				<p className="mt-2 text-[0.65rem] text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100 dark:text-zinc-500">
					{formatTimestamp(message.createdAt)}
				</p>
			</div>
		</div>
	);
}

export function TypingIndicator() {
	return (
		<div className="flex items-start gap-3">
			<Avatar className="size-6 shrink-0 bg-indigo-500 text-white" initials="AI" />
			<div className="rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3 dark:bg-zinc-800">
				<div className="flex gap-1.5">
					<span className="size-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
					<span className="size-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
					<span className="size-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
				</div>
			</div>
		</div>
	);
}
