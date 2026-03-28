export type SalesPitchAudience = "merchant" | "shared" | "shopper";

export type SalesPitchFootageMode = "auto" | "footage" | "placeholder";

export interface SalesPitchCompositionProps {
	brandLabel?: string;
	footageMode?: SalesPitchFootageMode;
	showGuides?: boolean;
	showSubtitles?: boolean;
	subtitleLabel?: string;
}

export interface SceneBeat {
	audience: SalesPitchAudience;
	description: string;
	endFrame: number;
	eyebrow: string;
	footageIds: string[];
	id:
		| "problem-open"
		| "shopper-assistant"
		| "trust"
		| "merchant-overview"
		| "approval"
		| "grounding"
		| "closing";
	startFrame: number;
	title: string;
}

export interface FootageCue {
	description: string;
	id: string;
	label: string;
	placeholderTitle: string;
	src: string;
	trimBeforeFrames?: number;
}

export interface NarrationLine {
	endFrame: number;
	id: string;
	startFrame: number;
	text: string;
}

export interface CaptionCue {
	endFrame: number;
	id: string;
	lines: string[];
	startFrame: number;
}
