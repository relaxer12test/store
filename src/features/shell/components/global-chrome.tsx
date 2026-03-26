import { Link } from "@tanstack/react-router";
import { useTransition } from "react";
import { StatusPill } from "@/components/ui/feedback";
import { authClient, useSessionEnvelope } from "@/lib/auth-client";
import { hasAdminSession } from "@/shared/contracts/session";

const navLinkClass =
	"inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900";

export function GlobalChrome() {
	const session = useSessionEnvelope();
	const [isPending, startTransition] = useTransition();
	const showInternalNav = hasAdminSession(session);

	return (
		<header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
			<div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
				<div className="flex items-center gap-4">
					<Link className="group inline-flex items-center gap-3" to="/">
						<span className="grid size-11 place-items-center rounded-[1.2rem] border border-slate-300 bg-slate-100 font-serif text-xl text-slate-900">
							GC
						</span>
						<span>
							<span className="block text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
								Shopify AI Console
							</span>
							<span className="mt-1 block font-serif text-2xl text-slate-900 transition group-hover:text-slate-700">
								Contract-first foundation
							</span>
						</span>
					</Link>
				</div>

				<div className="flex flex-wrap items-center gap-3">
					<Link className={navLinkClass} to="/">
						Marketing
					</Link>
					<Link className={navLinkClass} to="/install">
						Install
					</Link>
					<Link className={navLinkClass} to="/app">
						Merchant app
					</Link>
					{showInternalNav ? (
						<Link className={navLinkClass} to="/internal">
							Internal
						</Link>
					) : null}

					<StatusPill tone={session.state === "ready" ? "success" : "watch"}>
						{session.state === "ready" ? "Convex live" : "Convex offline"}
					</StatusPill>

					{showInternalNav ? (
						<button
							className={navLinkClass}
							disabled={isPending}
							onClick={() => {
								startTransition(() => {
									void (async () => {
										await authClient.signOut();
										window.location.assign("/");
									})();
								});
							}}
							type="button"
						>
							{isPending ? "Signing out" : "Sign out"}
						</button>
					) : null}

					{session.viewer ? (
						<StatusPill tone={session.roles.includes("admin") ? "accent" : "neutral"}>
							{session.viewer.name}
						</StatusPill>
					) : (
						<StatusPill tone="neutral">Unauthenticated</StatusPill>
					)}
				</div>
			</div>
		</header>
	);
}
