import { Link } from "@tanstack/react-router";
import { MetricGrid, Panel } from "@/components/ui/layout";
import type { MarketingSnapshot } from "@/shared/contracts/app-shell";

const primaryButtonClass =
	"inline-flex items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800";
const secondaryButtonClass =
	"inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950";

export function MarketingLandingPage({ snapshot }: { snapshot: MarketingSnapshot }) {
	return (
		<div className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16">
			<section className="grid gap-10 lg:grid-cols-[1.25fr_0.9fr] lg:items-end">
				<div>
					<p className="text-[0.72rem] font-semibold uppercase tracking-[0.32em] text-slate-500">
						{snapshot.heroEyebrow}
					</p>
					<h1 className="mt-5 max-w-4xl font-serif text-6xl leading-[0.92] text-slate-950 sm:text-7xl">
						{snapshot.heroTitle}
					</h1>
					<p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">{snapshot.heroSummary}</p>
					<div className="mt-8 flex flex-wrap gap-4">
						<Link className={primaryButtonClass} to="/install">
							Open install guide
						</Link>
						<Link className={secondaryButtonClass} to="/app">
							Enter merchant preview
						</Link>
					</div>
				</div>

				<Panel
					description="This is the V1 operating shape: SSR-hydrated TanStack Start, Convex-only backend behavior, and storefront-safe AI boundaries."
					title="Contract checkpoints"
				>
					<ul className="space-y-4">
						{snapshot.installSteps.map((step) => (
							<li
								className="rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-900"
								key={step}
							>
								{step}
							</li>
						))}
					</ul>
				</Panel>
			</section>

			<section className="mt-12">
				<MetricGrid metrics={snapshot.heroStats} />
			</section>

			<section className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
				<div className="grid gap-5 md:grid-cols-2">
					{snapshot.proofPoints.map((point) => (
						<article
							className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
							key={point.title}
						>
							<p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-slate-500">
								{point.title}
							</p>
							<p className="mt-4 font-serif text-3xl leading-tight text-slate-950">
								{point.summary}
							</p>
							<p className="mt-4 text-sm leading-7 text-slate-600">{point.detail}</p>
						</article>
					))}
				</div>

				<div className="rounded-[2rem] border border-slate-200 bg-slate-100 p-7">
					<p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-500">
						Storefront embed
					</p>
					<h2 className="mt-4 max-w-sm font-serif text-4xl leading-tight text-slate-950">
						Safe shopper AI stays useful without acting like an admin user.
					</h2>
					<p className="mt-5 max-w-xl text-sm leading-7 text-slate-700">
						{snapshot.storefrontCallout}
					</p>
					<div className="mt-8 rounded-[1.4rem] border border-slate-200 bg-white p-4">
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
							Theme embed moodboard
						</p>
						<div className="mt-4 grid gap-3">
							<div className="rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900">
								“Show me travel-ready duffels under $200 with matching accessories.”
							</div>
							<div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900">
								Concierge can answer, filter, compare, and build carts. It cannot create discounts
								or mutate Shopify admin state.
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
