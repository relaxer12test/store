import { z } from "zod";

export const dashboardToneSchema = z.union([
	z.literal("accent"),
	z.literal("success"),
	z.literal("watch"),
	z.literal("blocked"),
	z.literal("neutral"),
]);

export const dashboardValueSchema = z.union([z.string(), z.number(), z.null()]);

export const dashboardSeriesPointSchema = z.object({
	label: z.string(),
	value: z.number(),
});

export const dashboardMetricCardSchema = z.object({
	description: z.string(),
	id: z.string(),
	tone: dashboardToneSchema,
	type: z.literal("metric"),
	value: z.string(),
	valueLabel: z.string(),
});

export const dashboardLineChartCardSchema = z.object({
	description: z.string(),
	id: z.string(),
	points: z.array(dashboardSeriesPointSchema),
	seriesLabel: z.string(),
	type: z.literal("line_chart"),
});

export const dashboardBarChartCardSchema = z.object({
	description: z.string(),
	id: z.string(),
	points: z.array(dashboardSeriesPointSchema),
	seriesLabel: z.string(),
	type: z.literal("bar_chart"),
});

export const dashboardTableRowSchema = z.record(z.string(), dashboardValueSchema);

export const dashboardTableCardSchema = z.object({
	columns: z.array(z.string()),
	description: z.string(),
	id: z.string(),
	rows: z.array(dashboardTableRowSchema),
	type: z.literal("table"),
});

export const dashboardInsightCardSchema = z.object({
	bullets: z.array(z.string()),
	description: z.string(),
	id: z.string(),
	tone: dashboardToneSchema,
	type: z.literal("insight"),
});

export const dashboardCardSchema = z.union([
	dashboardMetricCardSchema,
	dashboardLineChartCardSchema,
	dashboardBarChartCardSchema,
	dashboardTableCardSchema,
	dashboardInsightCardSchema,
]);

export const dashboardSpecSchema = z.object({
	cards: z.array(dashboardCardSchema),
	description: z.string(),
	generatedAt: z.string(),
	title: z.string(),
});

export type DashboardSpec = z.infer<typeof dashboardSpecSchema>;

export interface MerchantCitation {
	detail: string;
	href: string | null;
	label: string;
	sourceType: "approval" | "document" | "shopify" | "workflow";
}

export interface MerchantApprovalChange {
	after: string | null;
	before: string | null;
	label: string;
}

export interface MerchantApprovalCard {
	decidedAt: string | null;
	errorMessage: string | null;
	id: string;
	plannedChanges: MerchantApprovalChange[];
	requestedAt: string;
	resultSummary: string | null;
	riskSummary: string;
	status: "approved" | "executing" | "failed" | "pending" | "rejected";
	summary: string;
	targetLabel: string;
	targetShopDomain: string;
	targetType: string;
	tool: string;
}

export interface MerchantCopilotMessage {
	approvals: MerchantApprovalCard[];
	body: string;
	citations: MerchantCitation[];
	createdAt: string;
	dashboard: DashboardSpec | null;
	id: string;
	role: "assistant" | "system" | "user";
	toolNames: string[];
}

export interface MerchantCopilotConversation {
	conversationId: string | null;
	latestDashboard: DashboardSpec | null;
	messages: MerchantCopilotMessage[];
	pendingApprovals: MerchantApprovalCard[];
	quickPrompts: string[];
}

export interface MerchantCopilotSessionSummary {
	conversationId: string;
	createdAt: string;
	lastAssistantSummary: string | null;
	lastPromptPreview: string | null;
	pendingApprovalCount: number;
	title: string;
	updatedAt: string;
}

export interface MerchantCopilotSessionsData {
	generatedAt: string;
	sessions: MerchantCopilotSessionSummary[];
}

export const merchantExplorerDatasetKeys = [
	"products",
	"orders",
	"inventory",
	"documents",
	"audit_logs",
] as const;

export type MerchantExplorerDatasetKey = (typeof merchantExplorerDatasetKeys)[number];

export interface MerchantExplorerDataset {
	description: string;
	key: MerchantExplorerDatasetKey;
	rows: Array<Record<string, string | number | null>>;
	title: string;
}

export interface MerchantExplorerData {
	datasets: MerchantExplorerDataset[];
	generatedAt: string;
}

export interface MerchantExplorerPageInfo {
	continueCursor: string | null;
	isDone: boolean;
}

export interface MerchantExplorerSummary {
	description: string;
	resultLabel: string | null;
	title: string;
}

export interface MerchantExplorerSource {
	kind: "convex" | "shopify_cached" | "shopify_live";
	label: string;
}

export interface MerchantExplorerSyncState {
	activeJobCount: number;
	canResume: boolean;
	cacheKey: string;
	completedStepCount: number;
	hasSnapshot: boolean;
	isStale: boolean;
	lastCompletedAt: string | null;
	lastError: string | null;
	lastRequestedAt: string | null;
	lastWebhookAt: string | null;
	pendingReason: string | null;
	processedCount: number | null;
	progressMessage: string | null;
	recordCount: number | null;
	staleWarning: string | null;
	status: string;
	totalStepCount: number | null;
	workflowId: string | null;
	workflowStatus: "canceled" | "completed" | "failed" | "inProgress" | "missing";
}

export interface MerchantExplorerPageData {
	generatedAt: string;
	pageInfo: MerchantExplorerPageInfo;
	rows: Array<Record<string, string | number | null>>;
	source: MerchantExplorerSource;
	summary: MerchantExplorerSummary;
	syncState?: MerchantExplorerSyncState | null;
}

export interface MerchantExplorerDetailField {
	label: string;
	tone?: "code" | "neutral" | "status";
	value: string | null;
}

export interface MerchantExplorerDetailSection {
	body: string;
	title: string;
	tone?: "neutral" | "code";
}

export interface MerchantExplorerDetailData {
	description: string | null;
	fields: MerchantExplorerDetailField[];
	generatedAt: string;
	sections: MerchantExplorerDetailSection[];
	source: MerchantExplorerSource;
	title: string;
}

export interface MerchantWorkflowLog {
	createdAt: string;
	detail: string | null;
	level: "error" | "info" | "success" | "watch";
	message: string;
}

export interface MerchantWorkflowRecord {
	cacheKey: string | null;
	completedAt: string | null;
	error: string | null;
	id: string;
	lastUpdatedAt: string;
	logs: MerchantWorkflowLog[];
	payloadPreview: string | null;
	requestedAt: string | null;
	resultSummary: string | null;
	retryAt: string | null;
	retryCount: number;
	source: string | null;
	startedAt: string | null;
	status: string;
	title: string;
	type: string;
}

export interface MerchantWorkflowsData {
	generatedAt: string;
	records: MerchantWorkflowRecord[];
}

export interface MerchantDocumentRecord {
	chunkCount: number | null;
	contentPreview: string;
	failureReason: string | null;
	fileName: string | null;
	id: string;
	sourceType: string;
	status: "failed" | "processing" | "ready";
	summary: string;
	title: string;
	updatedAt: string;
	visibility: "public" | "shop_private";
}

export interface MerchantKnowledgeDocumentsData {
	documents: MerchantDocumentRecord[];
	generatedAt: string;
}

export interface MerchantOverviewData {
	dashboard: DashboardSpec;
	generatedAt: string;
	pendingApprovals: MerchantApprovalCard[];
	recentWorkflows: MerchantWorkflowRecord[];
}
