export type Tone = "accent" | "success" | "watch" | "blocked" | "neutral";

export interface MetricCard {
	label: string;
	value: string;
	delta: string;
	hint: string;
	tone: Tone;
}

export interface SignalLine {
	label: string;
	detail: string;
	tone: Tone;
}

export interface TimelineItem {
	title: string;
	detail: string;
	meta: string;
}

export interface TableRecord {
	id: string;
	[key: string]: string;
}

export interface AiMessage {
	id: string;
	role: "assistant" | "user" | "system";
	content: string;
	tag?: string;
}

export interface MarketingFeature {
	title: string;
	summary: string;
	detail: string;
}

export interface MarketingSnapshot {
	heroEyebrow: string;
	heroTitle: string;
	heroSummary: string;
	heroStats: MetricCard[];
	proofPoints: MarketingFeature[];
	installSteps: string[];
	storefrontCallout: string;
}

export interface InstallGuideSnapshot {
	title: string;
	summary: string;
	checklist: string[];
	notes: SignalLine[];
}

export interface MerchantOverviewSnapshot {
	title: string;
	summary: string;
	metrics: MetricCard[];
	signals: SignalLine[];
	timeline: TimelineItem[];
}

export interface ModuleSnapshot {
	eyebrow: string;
	title: string;
	summary: string;
	chips: string[];
	signals: SignalLine[];
	timeline: TimelineItem[];
	records?: TableRecord[];
	messages?: AiMessage[];
}

export interface OpsOverviewSnapshot {
	title: string;
	summary: string;
	metrics: MetricCard[];
	signals: SignalLine[];
	timeline: TimelineItem[];
}
