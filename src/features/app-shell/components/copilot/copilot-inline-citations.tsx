import { Badge } from "@/components/ui/cata/badge";
import { Divider } from "@/components/ui/cata/divider";
import { Strong } from "@/components/ui/cata/text";
import type { MerchantCitation } from "@/shared/contracts/merchant-workspace";

function sourceLabel(sourceType: MerchantCitation["sourceType"]) {
	switch (sourceType) {
		case "approval":
			return "Approval";
		case "document":
			return "Document";
		case "workflow":
			return "Workflow";
		default:
			return "Shopify";
	}
}

export function CopilotInlineCitations({ citations }: { citations: MerchantCitation[] }) {
	if (citations.length === 0) {
		return null;
	}

	return (
		<div className="mt-4">
			<Divider soft />
			<p className="mt-3 text-[0.65rem] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
				Sources
			</p>
			<ul className="mt-2 space-y-1">
				{citations.map((citation, index) => (
					<li
						className="flex items-baseline gap-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400"
						key={`${citation.sourceType}-${citation.label}-${citation.detail}`}
					>
						<Badge className="shrink-0 text-[0.6rem]" color="zinc">
							{index + 1}
						</Badge>
						<span>
							<Strong className="text-xs">{sourceLabel(citation.sourceType)}</Strong>
							{": "}
							{citation.label}
							{citation.detail ? (
								<span className="text-zinc-400 dark:text-zinc-500"> — {citation.detail}</span>
							) : null}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}
