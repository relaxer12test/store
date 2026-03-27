import type { Id } from "@convex/_generated/dataModel";

export interface InternalPageInfo {
	continueCursor: string | null;
	isDone: boolean;
}

export interface InternalShopsListData {
	generatedAt: string;
	pageInfo: InternalPageInfo;
	records: InternalShopSummary[];
}

export interface InternalShopSummary {
	createdAt: string;
	domain: string;
	id: Id<"shops">;
	installStatus: "connected" | "inactive" | "pending";
	lastAuthenticatedAt: string | null;
	lastTokenExchangeAt: string | null;
	name: string;
	planDisplayName: string | null;
	shopifyShopId: string | null;
	tokenStatus: string | null;
}

export interface InternalShopDetailData {
	installation: {
		accessTokenExpiresAt: string | null;
		apiVersion: string;
		lastTokenExchangeAt: string | null;
		refreshTokenExpiresAt: string | null;
		scopeCount: number;
		status: string;
	} | null;
	memberCount: number;
	organizationCount: number;
	recentAiSessions: InternalAiSessionSummary[];
	recentCacheStates: InternalCacheStateSummary[];
	recentWebhookDeliveries: InternalWebhookDeliverySummary[];
	recentWorkflows: InternalWorkflowSummary[];
	shop: InternalShopSummary;
}

export interface InternalCacheStatesListData {
	generatedAt: string;
	pageInfo: InternalPageInfo;
	records: InternalCacheStateSummary[];
}

export interface InternalCacheStateSummary {
	cacheKey: string;
	domain: string;
	id: Id<"shopifyCacheStates">;
	lastCompletedAt: string | null;
	lastRequestedAt: string | null;
	lastWebhookAt: string | null;
	recordCount: number;
	shopId: Id<"shops">;
	status: string;
	updatedAt: string;
}

export interface InternalCacheStateDetailData {
	record: InternalCacheStateSummary & {
		enabled: boolean;
		lastError: string | null;
		lastFailedAt: string | null;
		lastReconciledAt: string | null;
		lastRefreshedAt: string | null;
		lastSourceUpdatedAt: string | null;
		lastStartedAt: string | null;
		pendingReason: string | null;
		staleAfterAt: string | null;
	};
	recentWebhookDeliveries: InternalWebhookDeliverySummary[];
	recentWorkflows: InternalWorkflowSummary[];
	shopName: string;
}

export interface InternalWorkflowsListData {
	generatedAt: string;
	pageInfo: InternalPageInfo;
	records: InternalWorkflowSummary[];
}

export interface InternalWorkflowSummary {
	cacheKey: string | null;
	completedAt: string | null;
	domain: string;
	error: string | null;
	id: Id<"syncJobs">;
	lastUpdatedAt: string;
	payloadPreview: string | null;
	requestedAt: string | null;
	retryCount: number;
	shopId: Id<"shops">;
	source: string | null;
	startedAt: string | null;
	status: string;
	type: string;
}

export interface InternalWorkflowLog {
	createdAt: string;
	detail: string | null;
	level: string;
	message: string;
}

export interface InternalWorkflowDetailData {
	logs: InternalWorkflowLog[];
	record: InternalWorkflowSummary & {
		resultSummary: string | null;
		retryAt: string | null;
		shopName: string;
	};
}

export interface InternalWebhooksListData {
	generatedAt: string;
	pageInfo: InternalPageInfo;
	records: InternalWebhookDeliverySummary[];
}

export interface InternalWebhookDeliverySummary {
	deliveryKey: string | null;
	domain: string;
	error: string | null;
	id: Id<"webhookDeliveries">;
	processedAt: string | null;
	receivedAt: string;
	shopId: Id<"shops"> | null;
	status: string;
	topic: string;
	webhookId: string | null;
}

export interface InternalWebhookPayloadSummary {
	createdAt: string;
	id: Id<"webhookPayloads">;
	payloadPreview: string;
}

export interface InternalWebhookDetailData {
	payloads: InternalWebhookPayloadSummary[];
	record: InternalWebhookDeliverySummary & {
		apiVersion: string | null;
		eventId: string | null;
		shopName: string | null;
		triggeredAt: string | null;
	};
}

export interface InternalAuditsListData {
	generatedAt: string;
	pageInfo: InternalPageInfo;
	records: InternalAuditSummary[];
}

export interface InternalAuditSummary {
	action: string;
	actorId: string | null;
	createdAt: string;
	detail: string | null;
	id: Id<"auditLogs">;
	shopId: Id<"shops"> | null;
	status: string | null;
}

export interface InternalAuditDetailData {
	record: InternalAuditSummary & {
		payloadJson: string | null;
		shopDomain: string | null;
		shopName: string | null;
	};
}

export interface InternalAiSessionsListData {
	generatedAt: string;
	pageInfo: InternalPageInfo;
	records: InternalAiSessionSummary[];
}

export interface InternalAiSessionSummary {
	clientFingerprint: string | null;
	createdAt: string;
	id: Id<"storefrontAiSessions">;
	lastPromptAt: string;
	lastPromptPreview: string | null;
	lastRefusalReason: string | null;
	lastReplyAt: string | null;
	lastReplyPreview: string | null;
	lastReplyTone: "answer" | "refusal" | null;
	sessionId: string;
	shopDomain: string;
	shopId: Id<"shops">;
	shopName: string;
	threadId: string;
	updatedAt: string;
}

export interface InternalAiSessionDetailData {
	session: InternalAiSessionSummary & {
		lastCardCount: number;
		lastCartPlanItemCount: number;
		lastReplyOrder: number | null;
		threadError: string | null;
		threadStatus: "active" | "archived" | "missing";
		threadTitle: string | null;
		threadUserId: string | null;
	};
}

export interface InternalAiTranscriptMessage {
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

export interface InternalAiTranscriptPageData {
	generatedAt: string;
	messages: InternalAiTranscriptMessage[];
	pageInfo: InternalPageInfo;
}

export interface InternalUsersListData {
	generatedAt: string;
	pageInfo: InternalPageInfo;
	records: InternalUserSummary[];
}

export interface InternalUserSummary {
	banned: boolean;
	createdAt: string | null;
	email: string;
	id: string;
	name: string;
	role: string | null;
	updatedAt: string | null;
}

export interface InternalUserMembershipSummary {
	memberId: string;
	organizationId: string;
	role: string | null;
	shopDomain: string | null;
	shopId: string | null;
}

export interface InternalUserSessionSummary {
	activeOrganizationId: string | null;
	createdAt: string | null;
	expiresAt: string | null;
	id: string;
	updatedAt: string | null;
}

export interface InternalUserDetailData {
	user: InternalUserSummary & {
		activeOrganizationId: string | null;
		memberships: InternalUserMembershipSummary[];
		recentSessions: InternalUserSessionSummary[];
		sessionCount: number;
	};
}
