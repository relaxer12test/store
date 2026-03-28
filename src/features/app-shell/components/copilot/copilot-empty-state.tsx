import { ArrowRight } from "lucide-react";
import { Heading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";

export function CopilotEmptyState({
	onSubmit,
	quickPrompts,
}: {
	onSubmit: (prompt: string) => void;
	quickPrompts: string[];
}) {
	return (
		<div className="flex min-h-full items-center justify-center px-4 py-12">
			<div className="w-full max-w-lg text-center">
				<Heading className="font-serif text-3xl">How can I help?</Heading>
				<Text className="mt-3">
					Ask about products, orders, inventory, or stage an action for approval.
				</Text>

				{quickPrompts.length > 0 ? (
					<div className="mx-auto mt-8 grid max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
						{quickPrompts.map((prompt) => (
							<button
								className="group flex items-start gap-3 rounded-xl border border-zinc-950/5 p-4 text-left transition-colors hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-zinc-800"
								key={prompt}
								onClick={() => onSubmit(prompt)}
								type="button"
							>
								<span className="flex-1 text-xs leading-5 text-zinc-700 dark:text-zinc-300">
									{prompt}
								</span>
								<ArrowRight className="mt-0.5 size-3.5 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 dark:text-zinc-500" />
							</button>
						))}
					</div>
				) : null}
			</div>
		</div>
	);
}
