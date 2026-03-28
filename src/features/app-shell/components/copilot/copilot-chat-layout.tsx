import type { RefObject } from "react";

export function CopilotChatLayout({
	children,
	composer,
	threadRef,
}: {
	children: React.ReactNode;
	composer: React.ReactNode;
	threadRef: RefObject<HTMLDivElement | null>;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="min-h-0 flex-1 overflow-y-auto" ref={threadRef}>
				{children}
			</div>
			<div className="shrink-0 border-t border-zinc-950/5 pt-3 dark:border-white/5">{composer}</div>
		</div>
	);
}
