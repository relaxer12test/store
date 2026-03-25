import { Link } from "@tanstack/react-router";
import { StatusPill } from "@/components/ui/feedback";
import { useSessionEnvelope } from "@/features/auth/session/client";
import { isInternalToolsEnabled } from "@/lib/env";

const cardClass =
	"group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-5 transition hover:border-slate-300 hover:shadow-sm";

export function LandingPage() {
	const session = useSessionEnvelope();
	const showInternal = isInternalToolsEnabled() || session.roles.includes("internal_staff");

	return (
		<div className="mx-auto max-w-3xl px-5 py-16 lg:px-8 lg:py-24">
			<div className="flex flex-wrap items-center gap-3">
				<StatusPill tone={session.state === "ready" ? "success" : "watch"}>
					{session.state === "ready" ? "Convex live" : "Convex offline"}
				</StatusPill>
				{session.activeShop ? (
					<StatusPill tone="success">{session.activeShop.domain}</StatusPill>
				) : (
					<StatusPill tone="neutral">No shop connected</StatusPill>
				)}
			</div>

			<h1 className="mt-8 font-serif text-4xl text-slate-950">Shopify AI Console</h1>
			<p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
				Embedded admin shell on `storeai.ldev.cloud` with real Shopify bootstrap, webhook ingestion,
				diagnostics, and the remaining AI/storefront work still layered on top.
			</p>

			<nav className="mt-10 grid gap-4 sm:grid-cols-2">
				<Link className={cardClass} to="/app">
					<span className="text-sm font-semibold text-slate-900 group-hover:text-slate-950">
						Merchant app
					</span>
					<span className="text-xs leading-5 text-slate-500">Embedded Shopify admin surface</span>
				</Link>

				<Link className={cardClass} to="/install">
					<span className="text-sm font-semibold text-slate-900 group-hover:text-slate-950">
						Install
					</span>
					<span className="text-xs leading-5 text-slate-500">Connection setup and checklist</span>
				</Link>

				{showInternal ? (
					<Link className={cardClass} to="/internal">
						<span className="text-sm font-semibold text-slate-900 group-hover:text-slate-950">
							Internal tools
						</span>
						<span className="text-xs leading-5 text-slate-500">Diagnostics, webhooks, cache</span>
					</Link>
				) : null}
			</nav>
		</div>
	);
}
