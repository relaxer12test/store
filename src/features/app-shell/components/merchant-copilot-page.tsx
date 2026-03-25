import { useConvexAction } from "@convex-dev/react-query";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { api } from "@/lib/convex-api";
import type { SystemStatusSnapshot } from "@/shared/contracts/system-status";

const primaryButtonClass =
	"inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const inputClass =
	"w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400";

export function MerchantCopilotPage({ snapshot }: { snapshot: SystemStatusSnapshot }) {
	const requestAssistant = useConvexAction(api.merchantApp.assistant);
	const [prompt, setPrompt] = useState("");
	const assistantMutation = useMutation({
		mutationFn: requestAssistant,
	});

	if (snapshot.shops.length === 0) {
		return (
			<Panel
				description="The protected merchant assistant only runs after a real shop has authenticated through the embedded app."
				title="Merchant copilot"
			>
				<EmptyState
					body="No connected shop record exists yet, so there is nothing trustworthy for the copilot to answer from."
					title="Copilot waiting on install"
				/>
			</Panel>
		);
	}

	return (
		<Panel
			description="This protected assistant now answers from the authenticated shop's install health, webhook posture, and storefront embed diagnostics."
			title="Merchant copilot"
		>
			<form
				className="grid gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					assistantMutation.mutate({
						prompt,
					});
				}}
			>
				<label className="grid gap-2">
					<span className="text-sm font-semibold text-slate-900">Ask about the current shop</span>
					<textarea
						className={`${inputClass} min-h-28`}
						onChange={(event) => setPrompt(event.target.value)}
						placeholder="How do I activate the storefront widget on the live theme?"
						value={prompt}
					/>
				</label>

				<div className="flex flex-wrap items-center gap-3">
					<button
						className={primaryButtonClass}
						disabled={assistantMutation.isPending}
						type="submit"
					>
						{assistantMutation.isPending ? "Thinking..." : "Ask copilot"}
					</button>
					<StatusPill tone="neutral">{snapshot.shops[0]?.domain ?? "shop connected"}</StatusPill>
				</div>
			</form>

			{assistantMutation.data ? (
				<div className="mt-5 rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
					<p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Answer</p>
					<p className="mt-3 text-sm leading-7 text-slate-900">{assistantMutation.data.answer}</p>
					{assistantMutation.data.nextActions.length > 0 ? (
						<ul className="mt-4 space-y-2">
							{assistantMutation.data.nextActions.map((action) => (
								<li
									className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900"
									key={action}
								>
									{action}
								</li>
							))}
						</ul>
					) : null}
				</div>
			) : null}

			{assistantMutation.error ? (
				<div className="mt-5">
					<EmptyState body={assistantMutation.error.message} title="Copilot request failed" />
				</div>
			) : null}
		</Panel>
	);
}
