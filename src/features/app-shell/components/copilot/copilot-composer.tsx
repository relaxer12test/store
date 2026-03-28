import { ArrowUp } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/cata/button";
import { Text } from "@/components/ui/cata/text";

export function CopilotComposer({
	error,
	isWorking,
	onSubmit,
	quickPrompts,
	showChips,
}: {
	error: Error | null;
	isWorking: boolean;
	onSubmit: (prompt: string) => void;
	quickPrompts: string[];
	showChips: boolean;
}) {
	const [prompt, setPrompt] = useState("");
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const adjustHeight = useCallback(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
	}, []);

	function handleSubmit() {
		const trimmed = prompt.trim();
		if (trimmed.length < 4 || isWorking) return;
		onSubmit(trimmed);
		setPrompt("");
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
			event.preventDefault();
			handleSubmit();
		}
	}

	const canSubmit = prompt.trim().length >= 4 && !isWorking;

	return (
		<div className="mx-auto w-full max-w-3xl px-4 pb-4">
			{showChips && quickPrompts.length > 0 ? (
				<div className="mb-3 flex gap-2 overflow-x-auto">
					{quickPrompts.map((qp) => (
						<Button
							className="shrink-0 text-xs"
							disabled={isWorking}
							key={qp}
							onClick={() => onSubmit(qp)}
							outline
							type="button"
						>
							{qp}
						</Button>
					))}
				</div>
			) : null}

			<div className="flex items-end gap-2 rounded-2xl border border-zinc-950/10 bg-white p-2 dark:border-white/10 dark:bg-zinc-900">
				<textarea
					className="max-h-[200px] min-h-[40px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-6 text-zinc-950 outline-none placeholder:text-zinc-400 dark:text-white dark:placeholder:text-zinc-500"
					disabled={isWorking}
					onChange={(event) => {
						setPrompt(event.target.value);
						adjustHeight();
					}}
					onKeyDown={handleKeyDown}
					placeholder="Ask about products, orders, inventory, or stage an action..."
					ref={textareaRef}
					rows={1}
					value={prompt}
				/>
				<button
					className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition-opacity disabled:opacity-30 dark:bg-zinc-100 dark:text-zinc-900"
					disabled={!canSubmit}
					onClick={handleSubmit}
					type="button"
				>
					<ArrowUp className="size-4" />
				</button>
			</div>

			{error ? (
				<Text className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error.message}</Text>
			) : null}

			<p className="mt-2 text-center text-[0.6rem] text-zinc-400 dark:text-zinc-500">
				{isWorking ? "Working..." : "Cmd+Enter to send"}
			</p>
		</div>
	);
}
