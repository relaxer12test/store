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
