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

export interface MerchantExplorerDataset {
	description: string;
	key: "audit_logs" | "documents" | "inventory" | "orders" | "products";
	rows: Array<Record<string, string | number | null>>;
	title: string;
}

export interface MerchantExplorerData {
	datasets: MerchantExplorerDataset[];
	generatedAt: string;
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
	contentPreview: string;
	fileName: string | null;
	id: string;
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
