import { Subheading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";
import { Textarea } from "@/components/ui/cata/textarea";
import { StatusPill } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import type { AiMessage } from "@/shared/contracts/app-shell";

export function AiThreadShell({
	className,
	messages,
	title,
}: {
	className?: string;
	messages: AiMessage[];
	title: string;
}) {
	return (
		<section
			className={cn(
				"rounded-lg border border-zinc-950/5 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-zinc-900",
				className,
			)}
		>
			<div className="mb-6 flex items-center justify-between gap-4">
				<div>
					<p className="text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-zinc-500 dark:text-zinc-400">
						Approval-aware assistant
					</p>
					<Subheading className="mt-2 font-serif text-3xl">{title}</Subheading>
				</div>
				<StatusPill tone="neutral">Merchant scoped</StatusPill>
			</div>

			<div className="space-y-4">
				{messages.map((message) => {
					const isAssistant = message.role === "assistant";

					return (
						<article
							className={cn(
								"max-w-3xl rounded-lg border px-5 py-4",
								isAssistant
									? "border-blue-200 bg-blue-50"
									: "ml-auto border-zinc-950/5 bg-zinc-100 dark:border-white/10 dark:bg-zinc-800",
							)}
							key={message.id}
						>
							<div className="flex items-center justify-between gap-3">
								<p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
									{message.role}
								</p>
								{message.tag ? (
									<span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
										{message.tag}
									</span>
								) : null}
							</div>
							<Text className="mt-3 text-sm leading-7 text-zinc-900 dark:text-zinc-100">
								{message.content}
							</Text>
						</article>
					);
				})}
			</div>

			<div className="mt-6 rounded-lg border border-dashed border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
					Composer wrapper
				</p>
				<Textarea
					className="mt-3 min-h-28"
					defaultValue="Draft a merchant-facing answer that cites warehouse data and requests approval before any admin mutation."
					resizable={false}
				/>
			</div>
		</section>
	);
}
