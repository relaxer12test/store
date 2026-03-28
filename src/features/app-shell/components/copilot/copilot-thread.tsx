import { ArrowDown } from "lucide-react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import {
	AssistantMessage,
	TypingIndicator,
	UserMessage,
} from "@/features/app-shell/components/copilot/copilot-messages";
import type { MerchantCopilotMessage } from "@/shared/contracts/merchant-workspace";

export function useCopilotScroll(
	threadRef: RefObject<HTMLDivElement | null>,
	messageCount: number,
) {
	const scrollAnchorRef = useRef<HTMLDivElement>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const prevCountRef = useRef(messageCount);

	useEffect(() => {
		const container = threadRef.current;
		if (!container) return;

		function handleScroll() {
			if (!container) return;
			const threshold = 80;
			const atBottom =
				container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
			setIsAtBottom(atBottom);
		}

		container.addEventListener("scroll", handleScroll, { passive: true });
		return () => container.removeEventListener("scroll", handleScroll);
	}, [threadRef]);

	useEffect(() => {
		if (messageCount > prevCountRef.current && isAtBottom) {
			scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
		}
		prevCountRef.current = messageCount;
	}, [messageCount, isAtBottom]);

	const scrollToBottom = useCallback(() => {
		scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" });
	}, []);

	return { scrollAnchorRef, isAtBottom, scrollToBottom };
}

export function CopilotThread({
	activeApprovalId,
	isWorking,
	messages,
	onApprove,
	onReject,
	scrollAnchorRef,
}: {
	activeApprovalId?: string | null;
	isWorking: boolean;
	messages: MerchantCopilotMessage[];
	onApprove?: (approvalId: string) => void;
	onReject?: (approvalId: string) => void;
	scrollAnchorRef: RefObject<HTMLDivElement | null>;
}) {
	return (
		<div className="mx-auto w-full max-w-3xl px-4 py-6">
			<div className="flex flex-col gap-5">
				{messages.map((message) =>
					message.role === "user" ? (
						<UserMessage key={message.id} message={message} />
					) : (
						<AssistantMessage
							activeApprovalId={activeApprovalId}
							key={message.id}
							message={message}
							onApprove={onApprove}
							onReject={onReject}
						/>
					),
				)}
				{isWorking ? <TypingIndicator /> : null}
				<div ref={scrollAnchorRef} />
			</div>
		</div>
	);
}

export function ScrollToBottomButton({ onClick }: { onClick: () => void }) {
	return (
		<div className="pointer-events-none absolute inset-x-0 bottom-24 flex justify-center">
			<button
				className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-zinc-950/10 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
				onClick={onClick}
				type="button"
			>
				<ArrowDown className="size-3" />
				New messages
			</button>
		</div>
	);
}
