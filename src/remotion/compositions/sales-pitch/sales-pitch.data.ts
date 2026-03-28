import type {
	CaptionCue,
	FootageCue,
	NarrationLine,
	SceneBeat,
} from "@/remotion/compositions/sales-pitch/sales-pitch.types";

export const SALES_PITCH_FPS = 30;
export const SALES_PITCH_WIDTH = 1920;
export const SALES_PITCH_HEIGHT = 1080;
export const SALES_PITCH_TOTAL_SECONDS = 75;
export const SALES_PITCH_TOTAL_FRAMES = SALES_PITCH_TOTAL_SECONDS * SALES_PITCH_FPS;

function secondsToFrames(value: number) {
	return Math.round(value * SALES_PITCH_FPS);
}

export const SALES_PITCH_SCENE_BEATS: SceneBeat[] = [
	{
		audience: "shared",
		description: "Open with shopper hesitation and merchant overload as the two product tensions.",
		endFrame: secondsToFrames(6),
		eyebrow: "One system, two conversations",
		footageIds: [],
		id: "problem-open",
		startFrame: secondsToFrames(0),
		title: "The shopper wants guidance. The merchant wants control.",
	},
	{
		audience: "shopper",
		description:
			"Show the storefront assistant recommending products, comparing options, and building a cart plan.",
		endFrame: secondsToFrames(20),
		eyebrow: "Shopper perspective",
		footageIds: ["shopper-recommendation", "shopper-cart-plan"],
		id: "shopper-assistant",
		startFrame: secondsToFrames(6),
		title: "The storefront concierge turns intent into a confident next step.",
	},
	{
		audience: "shopper",
		description:
			"Highlight refusal behavior for hidden discounts, freebies, and other restricted asks.",
		endFrame: secondsToFrames(28),
		eyebrow: "Trust built in",
		footageIds: ["shopper-refusal"],
		id: "trust",
		startFrame: secondsToFrames(20),
		title: "Helpful AI without unsafe promises or policy drift.",
	},
	{
		audience: "merchant",
		description:
			"Move into the embedded merchant shell and show deterministic dashboard cards, approvals, and workflows.",
		endFrame: secondsToFrames(42),
		eyebrow: "Merchant perspective",
		footageIds: ["merchant-dashboard"],
		id: "merchant-overview",
		startFrame: secondsToFrames(28),
		title: "The merchant sees what the AI is doing before the store feels it.",
	},
	{
		audience: "merchant",
		description:
			"Show the merchant copilot answering against uploaded playbooks and live store context inside the app shell.",
		endFrame: secondsToFrames(56),
		eyebrow: "Merchant copilot",
		footageIds: ["merchant-approval-flow"],
		id: "approval",
		startFrame: secondsToFrames(42),
		title: "The merchant gets grounded guidance without leaving the app.",
	},
	{
		audience: "shared",
		description:
			"Show public knowledge helping the shopper while private SOPs remain visible only to merchant tooling.",
		endFrame: secondsToFrames(67),
		eyebrow: "Audience-scoped knowledge",
		footageIds: ["merchant-document-grounding"],
		id: "grounding",
		startFrame: secondsToFrames(56),
		title: "Public answers stay public. Private operating context stays private.",
	},
	{
		audience: "shared",
		description:
			"Close on traceability and a unified message about shopper assistance plus merchant control.",
		endFrame: secondsToFrames(75),
		eyebrow: "Controlled AI across both surfaces",
		footageIds: ["merchant-traceability-close"],
		id: "closing",
		startFrame: secondsToFrames(67),
		title: "Guide the shopper. Guard the merchant. Keep the system accountable.",
	},
];

export const SALES_PITCH_FOOTAGE_CUES: FootageCue[] = [
	{
		description:
			"Deployed storefront capture of the shopper opening the widget, seeing recommendations, and browsing product cards.",
		id: "shopper-recommendation",
		label: "Shopper recommendation",
		placeholderTitle: "Storefront recommendation capture",
		src: "remotion/footage/shopper-recommendation.mp4",
	},
	{
		description:
			"Deployed storefront capture of bundle suggestions or a cart plan being built from the shopper conversation.",
		id: "shopper-cart-plan",
		label: "Cart plan",
		placeholderTitle: "Storefront cart-plan capture",
		src: "remotion/footage/shopper-cart-plan.mp4",
	},
	{
		description:
			"Deployed storefront capture showing a refusal for hidden discount codes, freebies, or other restricted asks.",
		id: "shopper-refusal",
		label: "Refusal behavior",
		placeholderTitle: "Storefront refusal capture",
		src: "remotion/footage/shopper-refusal.mp4",
	},
	{
		description:
			"Deployed admin capture of the merchant dashboard, pending approvals, workflow cards, and deterministic operational panels.",
		id: "merchant-dashboard",
		label: "Merchant dashboard",
		placeholderTitle: "Merchant dashboard capture",
		src: "remotion/footage/merchant-dashboard.mp4",
	},
	{
		description:
			"Deployed admin capture of the merchant copilot using uploaded playbooks and store context to guide a reorder workflow.",
		id: "merchant-approval-flow",
		label: "Merchant copilot",
		placeholderTitle: "Merchant copilot capture",
		src: "remotion/footage/merchant-approval-flow.mp4",
	},
	{
		description:
			"Deployed admin capture of document uploads or knowledge settings showing public versus shop-private usage.",
		id: "merchant-document-grounding",
		label: "Document grounding",
		placeholderTitle: "Document grounding capture",
		src: "remotion/footage/merchant-document-grounding.mp4",
	},
	{
		description:
			"Deployed admin capture of traceability surfaces such as workflows, audits, webhooks, or recent execution logs for the close.",
		id: "merchant-traceability-close",
		label: "Traceability close",
		placeholderTitle: "Traceability close capture",
		src: "remotion/footage/merchant-traceability-close.mp4",
	},
];

export const SALES_PITCH_NARRATION_LINES: NarrationLine[] = [
	{
		endFrame: secondsToFrames(2.8),
		id: "line-01",
		startFrame: secondsToFrames(0),
		text: "Shopping should feel guided, not abandoned.",
	},
	{
		endFrame: secondsToFrames(6),
		id: "line-02",
		startFrame: secondsToFrames(2.8),
		text: "Selling should feel controlled, not chaotic.",
	},
	{
		endFrame: secondsToFrames(10.5),
		id: "line-03",
		startFrame: secondsToFrames(6),
		text: "StoreAI meets the shopper in the storefront with safe, relevant recommendations.",
	},
	{
		endFrame: secondsToFrames(16),
		id: "line-04",
		startFrame: secondsToFrames(10.5),
		text: "It compares options, answers policy questions, and turns intent into a cart plan.",
	},
	{
		endFrame: secondsToFrames(20),
		id: "line-05",
		startFrame: secondsToFrames(16),
		text: "Helpful for the shopper, grounded in what the store can actually sell.",
	},
	{
		endFrame: secondsToFrames(24),
		id: "line-06",
		startFrame: secondsToFrames(20),
		text: "When someone asks for a hidden discount or a freebie, the assistant refuses.",
	},
	{
		endFrame: secondsToFrames(28),
		id: "line-07",
		startFrame: secondsToFrames(24),
		text: "Trust is part of the product, not a cleanup step after launch.",
	},
	{
		endFrame: secondsToFrames(34),
		id: "line-08",
		startFrame: secondsToFrames(28),
		text: "Inside Shopify admin, the merchant sees dashboards, pending approvals, and recent workflows.",
	},
	{
		endFrame: secondsToFrames(42),
		id: "line-09",
		startFrame: secondsToFrames(34),
		text: "The AI can assist the work without hiding what changed, what is queued, or what needs review.",
	},
	{
		endFrame: secondsToFrames(49),
		id: "line-10",
		startFrame: secondsToFrames(42),
		text: "Inside the merchant app, the copilot can reason over uploaded playbooks and live store context.",
	},
	{
		endFrame: secondsToFrames(56),
		id: "line-11",
		startFrame: secondsToFrames(49),
		text: "That guidance stays visible in the workflow-aware shell, so the next step stays grounded and reviewable.",
	},
	{
		endFrame: secondsToFrames(62),
		id: "line-12",
		startFrame: secondsToFrames(56),
		text: "Knowledge stays audience-aware: public policy helps shoppers, private SOPs stay merchant-only.",
	},
	{
		endFrame: secondsToFrames(67),
		id: "line-13",
		startFrame: secondsToFrames(62),
		text: "That means faster answers without exposing the wrong information to the wrong surface.",
	},
	{
		endFrame: secondsToFrames(75),
		id: "line-14",
		startFrame: secondsToFrames(67),
		text: "StoreAI brings shopper assistance and merchant control into one accountable AI system.",
	},
];

export const SALES_PITCH_CAPTION_CUES: CaptionCue[] = [
	{
		endFrame: secondsToFrames(2.8),
		id: "caption-01",
		lines: ["Shopping should feel guided,", "not abandoned."],
		startFrame: secondsToFrames(0),
	},
	{
		endFrame: secondsToFrames(6),
		id: "caption-02",
		lines: ["Selling should feel controlled,", "not chaotic."],
		startFrame: secondsToFrames(2.8),
	},
	{
		endFrame: secondsToFrames(10.5),
		id: "caption-03",
		lines: ["StoreAI meets the shopper in the storefront", "with safe, relevant recommendations."],
		startFrame: secondsToFrames(6),
	},
	{
		endFrame: secondsToFrames(16),
		id: "caption-04",
		lines: ["It compares options, answers policy questions,", "and turns intent into a cart plan."],
		startFrame: secondsToFrames(10.5),
	},
	{
		endFrame: secondsToFrames(20),
		id: "caption-05",
		lines: ["Helpful for the shopper,", "grounded in what the store can actually sell."],
		startFrame: secondsToFrames(16),
	},
	{
		endFrame: secondsToFrames(24),
		id: "caption-06",
		lines: ["Hidden discount? Freebie ask?", "The assistant refuses."],
		startFrame: secondsToFrames(20),
	},
	{
		endFrame: secondsToFrames(28),
		id: "caption-07",
		lines: ["Trust is part of the product,", "not a cleanup step."],
		startFrame: secondsToFrames(24),
	},
	{
		endFrame: secondsToFrames(34),
		id: "caption-08",
		lines: ["Inside Shopify admin, the merchant sees", "dashboards, approvals, and workflows."],
		startFrame: secondsToFrames(28),
	},
	{
		endFrame: secondsToFrames(42),
		id: "caption-09",
		lines: ["The AI assists the work", "without hiding what changed or why."],
		startFrame: secondsToFrames(34),
	},
	{
		endFrame: secondsToFrames(49),
		id: "caption-10",
		lines: ["The merchant copilot reasons over", "uploaded playbooks and live store context."],
		startFrame: secondsToFrames(42),
	},
	{
		endFrame: secondsToFrames(56),
		id: "caption-11",
		lines: ["The guidance stays in the app shell,", "so the next step stays reviewable."],
		startFrame: secondsToFrames(49),
	},
	{
		endFrame: secondsToFrames(62),
		id: "caption-12",
		lines: ["Public policy helps shoppers.", "Private SOPs stay merchant-only."],
		startFrame: secondsToFrames(56),
	},
	{
		endFrame: secondsToFrames(67),
		id: "caption-13",
		lines: ["Faster answers,", "without exposing the wrong information."],
		startFrame: secondsToFrames(62),
	},
	{
		endFrame: secondsToFrames(75),
		id: "caption-14",
		lines: ["StoreAI combines shopper assistance", "with merchant control and accountability."],
		startFrame: secondsToFrames(67),
	},
];
