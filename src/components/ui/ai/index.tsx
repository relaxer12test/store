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
			className={cn("rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm", className)}
		>
			<div className="mb-6 flex items-center justify-between gap-4">
				<div>
					<p className="text-[0.7rem] font-semibold uppercase tracking-[0.26em] text-slate-500">
						Approval-aware assistant
					</p>
					<h2 className="mt-2 font-serif text-3xl text-slate-950">{title}</h2>
				</div>
				<span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-600">
					Merchant scoped
				</span>
			</div>

			<div className="space-y-4">
				{messages.map((message) => {
					const isAssistant = message.role === "assistant";

					return (
						<article
							className={cn(
								"max-w-3xl rounded-[1.4rem] border px-5 py-4",
								isAssistant
									? "border-blue-200 bg-blue-50"
									: "ml-auto border-slate-200 bg-slate-100",
							)}
							key={message.id}
						>
							<div className="flex items-center justify-between gap-3">
								<p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
									{message.role}
								</p>
								{message.tag ? (
									<span className="text-xs font-medium text-slate-500">{message.tag}</span>
								) : null}
							</div>
							<p className="mt-3 text-sm leading-7 text-slate-900">{message.content}</p>
						</article>
					);
				})}
			</div>

			<div className="mt-6 rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 p-4">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
					Composer wrapper
				</p>
				<textarea
					className="mt-3 min-h-28 w-full resize-none rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
					defaultValue="Draft a merchant-facing answer that cites warehouse data and requests approval before any admin mutation."
				/>
			</div>
		</section>
	);
}
