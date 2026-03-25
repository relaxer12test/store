import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui/layout";

const primaryButtonClass =
	"inline-flex items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800";
const secondaryButtonClass =
	"inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950";

const connectionFacts = [
	"TanStack Start serves the shell from Cloudflare Workers.",
	"Convex is the only backend in this repo.",
	"No fabricated merchant KPIs or fake Shopify rows are rendered anymore.",
	"Embedded auth is shell-first, but real Shopify token verification is still not wired.",
];

export function LandingPage() {
	return (
		<div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
			<section className="grid gap-10 lg:grid-cols-[1.25fr_0.9fr] lg:items-end">
				<div>
					<p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-slate-500">
						Growth Capital takehome
					</p>
					<h1 className="mt-5 max-w-4xl font-serif text-6xl leading-[0.92] text-slate-950 sm:text-7xl">
						Shopify app shell wired for real backend work, without fake merchant data.
					</h1>
					<p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
						The repo now shows the actual state of the connection. If data is missing, the UI says
						it is missing instead of inventing metrics, traces, or installation records.
					</p>
					<div className="mt-8 flex flex-wrap gap-4">
						<Link className={primaryButtonClass} to="/install">
							Open connection checklist
						</Link>
						<Link className={secondaryButtonClass} to="/app">
							Open embedded app shell
						</Link>
					</div>
				</div>

				<Panel
					description="These points describe what the current codebase actually does."
					title="Current state"
				>
					<ul className="space-y-4">
						{connectionFacts.map((fact) => (
							<li
								className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-900"
								key={fact}
							>
								{fact}
							</li>
						))}
					</ul>
				</Panel>
			</section>

			<section className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
				<Panel
					description="These are the next backend milestones needed before the app can talk to Shopify for real."
					title="What is still missing"
				>
					<ul className="space-y-4 text-sm leading-7 text-slate-700">
						<li>No verified Shopify session-token path on the backend yet.</li>
						<li>No install/OAuth callback flow storing a real connected shop record.</li>
						<li>No webhook ingestion writing live deliveries into Convex.</li>
						<li>No mirrored Shopify catalog/order/inventory tables yet.</li>
					</ul>
				</Panel>

				<div className="rounded-[2rem] border border-slate-200 bg-slate-100 p-7">
					<p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
						Storefront embed
					</p>
					<h2 className="mt-4 max-w-sm font-serif text-4xl leading-tight text-slate-950">
						Safe shopper AI stays useful without acting like an admin user.
					</h2>
					<p className="mt-5 max-w-xl text-sm leading-7 text-slate-700">
						The storefront assistant should stay read-only, shopper-safe, and grounded on indexed
						catalog and policy data. That backend path still needs to be connected to real Shopify
						store data before the surface becomes meaningful.
					</p>
					<div className="mt-8 rounded-[1.4rem] border border-slate-200 bg-white p-4">
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
							Current rule
						</p>
						<div className="mt-4 grid gap-3">
							<div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900">
								No fake storefront chats, no fake recommendations, and no fake products until the
								store connection is real.
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
