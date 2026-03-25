import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTransition } from "react";
import { StatusPill } from "@/components/ui/feedback";
import { PageHeader, Panel } from "@/components/ui/layout";
import { clearPreviewSession, setPreviewSession } from "@/features/auth/session/server";
import type { InstallGuideSnapshot } from "@/shared/contracts/app-shell";
import type { SessionEnvelope } from "@/shared/contracts/session";

const secondaryButtonClass =
	"inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-70";
const installModeCardClass =
	"rounded-[1.6rem] border border-slate-200 bg-white p-6 text-left transition hover:-translate-y-0.5 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-70";

export function InstallPreviewPage({
	guide,
	session,
}: {
	guide: InstallGuideSnapshot;
	session: SessionEnvelope;
}) {
	const navigate = useNavigate();
	const startPreviewSession = useServerFn(setPreviewSession);
	const endPreviewSession = useServerFn(clearPreviewSession);
	const [isPending, startTransition] = useTransition();

	const runMode = (mode: "merchant" | "internal") => {
		startTransition(async () => {
			const result = await startPreviewSession({ data: { mode } });
			await navigate({ to: result.redirectTo });
		});
	};

	const clearMode = () => {
		startTransition(async () => {
			const result = await endPreviewSession();
			await navigate({ to: result.redirectTo });
		});
	};

	return (
		<div className="mx-auto max-w-6xl px-5 py-12 lg:px-8 lg:py-16">
			<PageHeader
				actions={
					session.viewer ? (
						<button className={secondaryButtonClass} onClick={clearMode} type="button">
							{isPending ? "Resetting preview…" : "Reset preview"}
						</button>
					) : null
				}
				description={guide.summary}
				eyebrow="Merchant onboarding"
				title={guide.title}
			/>

			<section className="mt-10 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
				<Panel
					description="This route stands in for the real install/bootstrap flow. Right now it sets a same-origin preview cookie so `/app` and `/internal` can exercise the shell-first route model without inventing a separate browser-login system."
					title="Preview surfaces"
				>
					<div className="grid gap-4 md:grid-cols-2">
						<button
							className={installModeCardClass}
							disabled={isPending}
							onClick={() => runMode("merchant")}
							type="button"
						>
							<StatusPill tone="success">Merchant preview</StatusPill>
							<h2 className="mt-4 font-serif text-3xl text-slate-950">Open `/app`</h2>
							<p className="mt-3 text-sm leading-7 text-slate-600">
								Simulates a merchant admin session so the embedded shell and merchant routes can be
								exercised with preloaded data on first load.
							</p>
						</button>

						<button
							className={installModeCardClass}
							disabled={isPending}
							onClick={() => runMode("internal")}
							type="button"
						>
							<StatusPill tone="accent">Internal console preview</StatusPill>
							<h2 className="mt-4 font-serif text-3xl text-slate-950">Open `/internal`</h2>
							<p className="mt-3 text-sm leading-7 text-slate-600">
								Simulates a staff-only diagnostics session so install state, webhooks, and
								cache/debug tooling can be exercised while the real Shopify auth layer is still
								being built.
							</p>
						</button>
					</div>
				</Panel>

				<Panel
					description="These items map directly to the later Shopify/auth plans."
					title="Execution checklist"
				>
					<ol className="space-y-3">
						{guide.checklist.map((item) => (
							<li
								className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900"
								key={item}
							>
								{item}
							</li>
						))}
					</ol>
					<div className="mt-6 grid gap-3">
						{guide.notes.map((note) => (
							<div
								className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-3"
								key={note.label}
							>
								<div className="flex items-center gap-3">
									<StatusPill tone={note.tone}>{note.label}</StatusPill>
								</div>
								<p className="mt-3 text-sm leading-6 text-slate-600">{note.detail}</p>
							</div>
						))}
					</div>
				</Panel>
			</section>
		</div>
	);
}
