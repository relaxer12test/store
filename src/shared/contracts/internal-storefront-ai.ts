export interface InternalStorefrontAiSessionSummary {
	id: string;
	clientFingerprint: string | null;
	createdAt: string;
	lastPromptAt: string;
	lastPromptPreview: string | null;
	lastReplyAt: string | null;
	lastReplyPreview: string | null;
	lastReplyTone: "answer" | "refusal" | null;
	lastRefusalReason: string | null;
	sessionId: string;
	shopDomain: string;
	shopId: string;
	shopName: string;
	threadId: string;
	updatedAt: string;
}

export interface InternalStorefrontAiSessionsData {
	generatedAt: string;
	sessions: InternalStorefrontAiSessionSummary[];
}

export interface InternalStorefrontAiTranscriptMessage {
	body: string;
	createdAt: string;
	error: string | null;
	id: string;
	model: string | null;
	order: number;
	provider: string | null;
	role: "assistant" | "system" | "tool" | "user";
	status: "failed" | "pending" | "success";
	stepOrder: number;
}

export interface InternalStorefrontAiTranscriptData {
	clientFingerprint: string | null;
	createdAt: string;
	lastCardCount: number;
	lastCartPlanItemCount: number;
	lastPromptAt: string;
	lastPromptPreview: string | null;
	lastRefusalReason: string | null;
	lastReplyAt: string | null;
	lastReplyOrder: number | null;
	lastReplyPreview: string | null;
	lastReplyTone: "answer" | "refusal" | null;
	messages: InternalStorefrontAiTranscriptMessage[];
	messagesTruncated: boolean;
	sessionDocumentId: string;
	sessionId: string;
	shopDomain: string;
	shopId: string;
	shopName: string;
	threadError: string | null;
	threadId: string;
	threadStatus: "active" | "archived" | "missing";
	threadTitle: string | null;
	threadUserId: string | null;
	updatedAt: string;
}
