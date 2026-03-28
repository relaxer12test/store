import { createOpenAI } from "@ai-sdk/openai";
import { Agent, createTool, stepCountIs } from "@convex-dev/agent";
import { api, components, internal } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { ActionCtx } from "@convex/_generated/server";
import { requireMerchantClaims } from "@convex/auth";
import { getShopifyAccessFailureReason } from "@convex/shopifyAccess";
import type { ToolSet } from "ai";
import { z } from "zod";
import {
	dashboardSpecSchema,
	type DashboardSpec,
	type MerchantCitation,
	type MerchantCopilotConversation,
	type MerchantWorkflowRecord,
} from "@/shared/contracts/merchant-workspace";

type MerchantCopilotRuntimeArgs = {
	conversationId?: Id<"merchantCopilotConversations">;
	prompt: string;
};

type MerchantAgentCtx = ActionCtx & {
	actorId: string;
	shopDomain: string;
	shopId: Id<"shops">;
};

type ProductSnapshot = {
	description?: string | null;
	handle?: string | null;
	id?: string | null;
	status?: string | null;
	tags?: string[] | null;
	title?: string | null;
	updatedAt?: string | null;
	variants?: {
		nodes?: Array<{
			id?: string | null;
			inventoryItem?: {
				id?: string | null;
				sku?: string | null;
				tracked?: boolean | null;
			} | null;
			inventoryQuantity?: number | null;
			sku?: string | null;
			title?: string | null;
		}> | null;
	} | null;
	vendor?: string | null;
};

type OrderSnapshot = {
	currentTotalPriceSet?: {
		shopMoney?: {
			amount?: string | null;
			currencyCode?: string | null;
		} | null;
	} | null;
	displayFinancialStatus?: string | null;
	displayFulfillmentStatus?: string | null;
	name?: string | null;
	processedAt?: string | null;
};

type ProductContextSnapshot = {
	locations?: {
		nodes?: Array<{
			id?: string | null;
			isActive?: boolean | null;
			name?: string | null;
		}> | null;
	} | null;
	product?: {
		descriptionHtml?: string | null;
		handle?: string | null;
		id?: string | null;
		metafields?: {
			nodes?: Array<{
				compareDigest?: string | null;
				key?: string | null;
				namespace?: string | null;
				type?: string | null;
				value?: string | null;
			}> | null;
		} | null;
		status?: string | null;
		tags?: string[] | null;
		title?: string | null;
		variants?: {
			nodes?: Array<{
				id?: string | null;
				inventoryItem?: {
					id?: string | null;
					sku?: string | null;
					tracked?: boolean | null;
				} | null;
				inventoryQuantity?: number | null;
				sku?: string | null;
				title?: string | null;
			}> | null;
		} | null;
		vendor?: string | null;
	} | null;
};

type RetrievedKnowledgeMatch = {
	citation: MerchantCitation;
	documentId: Id<"merchantDocuments">;
	snippet: string;
	title: string;
	visibility: "public" | "shop_private";
};

type ProductCandidate = {
	handle: string;
	id: string;
	status: string | null;
	title: string;
	totalInventory: number;
	vendor: string | null;
};

type VariantCandidate = {
	id: string;
	inventoryItemId: string | null;
	inventoryQuantity: number;
	sku: string | null;
	title: string;
	tracked: boolean;
};

type LocationCandidate = {
	id: string;
	isActive: boolean;
	name: string;
};

type MerchantArtifact =
	| {
			approvalIds: Id<"merchantActionApprovals">[];
			body: string;
			citations: MerchantCitation[];
			dashboard?: DashboardSpec;
			kind: "approval";
	  }
	| {
			body: string;
			citations: MerchantCitation[];
			dashboard?: DashboardSpec;
			kind: "clarification" | "dashboard" | "workflow" | "answer";
	  };

type ToolArtifactEnvelope = {
	artifact?: MerchantArtifact | null;
};

type MerchantThreadState = {
	conversationId: Id<"merchantCopilotConversations">;
	threadId: string;
};

type WorkflowType =
	| "catalog_index_rebuild"
	| "dashboard_regeneration"
	| "document_reindex"
	| "metrics_cache_refresh"
	| "reconciliation_scan";

const DEFAULT_ANALYTICS_WINDOW_DAYS = 14;
const PRODUCT_CANDIDATE_LIMIT = 5;
const MERCHANT_TOOL_STEP_LIMIT = 8;
const SAFE_WORKFLOW_TYPES = [
	"catalog_index_rebuild",
	"dashboard_regeneration",
	"document_reindex",
	"metrics_cache_refresh",
	"reconciliation_scan",
] as const;
const workflowTypeSchema = z.enum(SAFE_WORKFLOW_TYPES);

let merchantAgentSingleton: Agent<MerchantAgentCtx> | null = null;

function getEnv(name: string) {
	return (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env?.[name];
}

function getRequiredAiApiKey() {
	const value = getEnv("CONVEX_OPENAI_API_KEY") ?? getEnv("OPENAI_API_KEY");

	if (!value) {
		throw new Error(
			"Missing `CONVEX_OPENAI_API_KEY` (or `OPENAI_API_KEY`) for the merchant copilot.",
		);
	}

	return value;
}

function getMerchantModelId() {
	return (
		getEnv("CONVEX_MERCHANT_COPILOT_MODEL") ?? getEnv("MERCHANT_COPILOT_MODEL") ?? "gpt-5.4-mini"
	);
}

function sanitizePromptPreview(prompt: string) {
	return prompt.trim().replace(/\s+/g, " ").slice(0, 180);
}

function normalizeText(value: string) {
	return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatMoney(amount: number, currencyCode?: string | null) {
	return new Intl.NumberFormat("en-US", {
		currency: currencyCode ?? "USD",
		style: "currency",
	}).format(amount);
}

function parseAmount(value: string | null | undefined) {
	if (!value) {
		return 0;
	}

	const amount = Number.parseFloat(value);
	return Number.isFinite(amount) ? amount : 0;
}

function compactNumber(value: number) {
	return new Intl.NumberFormat("en-US", {
		maximumFractionDigits: value >= 100 ? 0 : 1,
		notation: "compact",
	}).format(value);
}

function formatWorkflowTitle(type: WorkflowType) {
	switch (type) {
		case "catalog_index_rebuild":
			return "Catalog index rebuild";
		case "dashboard_regeneration":
			return "Dashboard regeneration";
		case "document_reindex":
			return "Document re-index";
		case "metrics_cache_refresh":
			return "Metrics cache refresh";
		case "reconciliation_scan":
			return "Sync reconciliation scan";
	}
}

function formatFromString(value: string | null | undefined) {
	if (!value) {
		return null;
	}

	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildShopifyCitation(label: string, detail: string): MerchantCitation {
	return {
		detail,
		href: null,
		label,
		sourceType: "shopify",
	};
}

function buildWorkflowCitation(label: string, detail: string): MerchantCitation {
	return {
		detail,
		href: null,
		label,
		sourceType: "workflow",
	};
}

function buildApprovalCitation(label: string, detail: string): MerchantCitation {
	return {
		detail,
		href: null,
		label,
		sourceType: "approval",
	};
}

function buildProductsDashboard(
	title: string,
	description: string,
	products: ProductCandidate[],
): DashboardSpec {
	return dashboardSpecSchema.parse({
		cards: [
			{
				description,
				id: "products-table",
				rows: products.map((product) => ({
					handle: product.handle,
					status: product.status,
					title: product.title,
					total_inventory: product.totalInventory,
					vendor: product.vendor,
				})),
				columns: ["title", "handle", "status", "vendor", "total_inventory"],
				type: "table",
			},
			{
				bullets: products.slice(0, 3).map((product) => `${product.title} (${product.handle})`),
				description: "Candidate matches from Shopify Admin product search.",
				id: "products-insight",
				tone: products.length > 1 ? "watch" : "success",
				type: "insight",
			},
		],
		description,
		generatedAt: new Date().toISOString(),
		title,
	});
}

function buildOrdersDashboard(
	title: string,
	description: string,
	orders: OrderSnapshot[],
	windowDays: number,
): DashboardSpec {
	const rows = orders.slice(0, 8).map((order) => ({
		financial_status: order.displayFinancialStatus ?? null,
		fulfillment_status: order.displayFulfillmentStatus ?? null,
		order: order.name ?? null,
		processed_at: formatFromString(order.processedAt) ?? order.processedAt ?? null,
		total: formatMoney(
			parseAmount(order.currentTotalPriceSet?.shopMoney?.amount),
			order.currentTotalPriceSet?.shopMoney?.currencyCode,
		),
	}));
	const revenueTotal = orders.reduce(
		(total, order) => total + parseAmount(order.currentTotalPriceSet?.shopMoney?.amount),
		0,
	);

	return dashboardSpecSchema.parse({
		cards: [
			{
				description: `Orders returned for the last ${windowDays} day(s).`,
				id: "orders-count",
				tone: orders.length > 0 ? "accent" : "watch",
				type: "metric",
				value: compactNumber(orders.length),
				valueLabel: "Orders",
			},
			{
				description: `Gross revenue across the same ${windowDays}-day window.`,
				id: "orders-revenue",
				tone: revenueTotal > 0 ? "success" : "watch",
				type: "metric",
				value: formatMoney(revenueTotal, orders[0]?.currentTotalPriceSet?.shopMoney?.currencyCode),
				valueLabel: "Revenue",
			},
			{
				description,
				id: "orders-table",
				rows,
				columns: ["order", "total", "processed_at", "financial_status", "fulfillment_status"],
				type: "table",
			},
		],
		description,
		generatedAt: new Date().toISOString(),
		title,
	});
}

function buildDocumentMatchesDashboard(matches: RetrievedKnowledgeMatch[]): DashboardSpec {
	return dashboardSpecSchema.parse({
		cards: [
			{
				description: "Best matching merchant knowledge snippets for this question.",
				id: "documents-table",
				rows: matches.map((match) => ({
					snippet: match.snippet,
					title: match.title,
					visibility: match.visibility,
				})),
				columns: ["title", "visibility", "snippet"],
				type: "table",
			},
			{
				bullets: matches.slice(0, 3).map((match) => match.snippet),
				description: "Top grounded excerpts that informed this turn.",
				id: "documents-insight",
				tone: matches.length > 0 ? "success" : "watch",
				type: "insight",
			},
		],
		description: "Merchant-private and public document grounding for the current prompt.",
		generatedAt: new Date().toISOString(),
		title: "Knowledge matches",
	});
}

function buildClarificationDashboard(
	title: string,
	description: string,
	columns: string[],
	rows: Array<Record<string, string | number | null>>,
): DashboardSpec {
	return dashboardSpecSchema.parse({
		cards: [
			{
				description,
				id: "clarification-table",
				rows,
				columns,
				type: "table",
			},
		],
		description,
		generatedAt: new Date().toISOString(),
		title,
	});
}

function buildWorkflowsDashboard(
	workflows: MerchantWorkflowRecord[],
	audits: Array<{
		action: string;
		created_at: string;
		detail: string | null;
		status: string | null;
	}>,
): DashboardSpec {
	return dashboardSpecSchema.parse({
		cards: [
			{
				description: "Recent merchant workflow rows.",
				id: "workflow-table",
				rows: workflows.slice(0, 6).map((workflow) => ({
					status: workflow.status,
					title: workflow.title,
					updated_at: workflow.lastUpdatedAt,
				})),
				columns: ["title", "status", "updated_at"],
				type: "table",
			},
			{
				description: "Recent audit rows written by merchant operations.",
				id: "audit-table",
				rows: audits.slice(0, 6),
				columns: ["action", "status", "created_at", "detail"],
				type: "table",
			},
		],
		description: "Workflow and audit inspection for merchant operations.",
		generatedAt: new Date().toISOString(),
		title: "Workflow health",
	});
}

function toProductCandidate(row: ProductSnapshot): ProductCandidate | null {
	if (!row.id || !row.title) {
		return null;
	}

	return {
		handle: row.handle ?? "",
		id: row.id,
		status: row.status ?? null,
		title: row.title,
		totalInventory: (row.variants?.nodes ?? []).reduce(
			(total, variant) => total + (variant.inventoryQuantity ?? 0),
			0,
		),
		vendor: row.vendor ?? null,
	};
}

function toVariantCandidates(context: ProductContextSnapshot): VariantCandidate[] {
	return (context.product?.variants?.nodes ?? [])
		.flatMap((variant) => {
			if (!variant?.id) {
				return [];
			}

			return [
				{
					id: variant.id,
					inventoryItemId: variant.inventoryItem?.id ?? null,
					inventoryQuantity: variant.inventoryQuantity ?? 0,
					sku: variant.sku ?? variant.inventoryItem?.sku ?? null,
					title: variant.title ?? "Default",
					tracked: variant.inventoryItem?.tracked ?? false,
				},
			];
		})
		.slice(0, 10);
}

function toLocationCandidates(context: ProductContextSnapshot): LocationCandidate[] {
	return (context.locations?.nodes ?? [])
		.flatMap((location) => {
			if (!location?.id) {
				return [];
			}

			return [
				{
					id: location.id,
					isActive: location.isActive ?? false,
					name: location.name ?? "Unknown location",
				},
			];
		})
		.slice(0, 10);
}

function resolveExactProduct(query: string, rows: ProductSnapshot[]) {
	const candidates = rows
		.map(toProductCandidate)
		.filter((candidate): candidate is ProductCandidate => Boolean(candidate))
		.slice(0, PRODUCT_CANDIDATE_LIMIT);
	const normalizedQuery = normalizeText(query);

	if (candidates.length === 1) {
		return {
			candidates,
			match: candidates[0],
			status: "exact" as const,
		};
	}

	const exactMatches = candidates.filter((candidate) => {
		return (
			normalizeText(candidate.title) === normalizedQuery ||
			(candidate.handle.length > 0 && normalizeText(candidate.handle) === normalizedQuery)
		);
	});

	if (exactMatches.length === 1) {
		return {
			candidates,
			match: exactMatches[0],
			status: "exact" as const,
		};
	}

	if (candidates.length === 0) {
		return {
			candidates,
			match: null,
			status: "not_found" as const,
		};
	}

	return {
		candidates,
		match: null,
		status: "ambiguous" as const,
	};
}

function resolveVariant(query: string | null | undefined, variants: VariantCandidate[]) {
	const normalizedQuery = query ? normalizeText(query) : null;

	if (variants.length === 1) {
		return {
			match: variants[0],
			status: "exact" as const,
		};
	}

	if (normalizedQuery) {
		const exactMatches = variants.filter((variant) => {
			return (
				normalizeText(variant.title) === normalizedQuery ||
				normalizeText(variant.id) === normalizedQuery ||
				(variant.sku ? normalizeText(variant.sku) === normalizedQuery : false)
			);
		});

		if (exactMatches.length === 1) {
			return {
				match: exactMatches[0],
				status: "exact" as const,
			};
		}
	}

	if (variants.length === 0) {
		return {
			match: null,
			status: "not_found" as const,
		};
	}

	return {
		match: null,
		status: "ambiguous" as const,
	};
}

function resolveLocation(query: string | null | undefined, locations: LocationCandidate[]) {
	const activeLocations = locations.filter((location) => location.isActive);
	const candidates = activeLocations.length > 0 ? activeLocations : locations;
	const normalizedQuery = query ? normalizeText(query) : null;

	if (candidates.length === 1) {
		return {
			match: candidates[0],
			status: "exact" as const,
		};
	}

	if (normalizedQuery) {
		const exactMatches = candidates.filter((location) => {
			return (
				normalizeText(location.name) === normalizedQuery ||
				normalizeText(location.id) === normalizedQuery
			);
		});

		if (exactMatches.length === 1) {
			return {
				match: exactMatches[0],
				status: "exact" as const,
			};
		}
	}

	if (candidates.length === 0) {
		return {
			match: null,
			status: "not_found" as const,
		};
	}

	return {
		match: null,
		status: "ambiguous" as const,
	};
}

function approvalPlannedChange(label: string, before: string | null, after: string | null) {
	return {
		after,
		before,
		label,
	};
}

function getMerchantAgent() {
	if (!merchantAgentSingleton) {
		const openai = createOpenAI({
			apiKey: getRequiredAiApiKey(),
		});

		merchantAgentSingleton = new Agent<MerchantAgentCtx>(components.agent, {
			callSettings: {
				maxOutputTokens: 700,
				temperature: 0.15,
			},
			languageModel: openai.responses(getMerchantModelId()),
			name: "merchant_copilot",
			stopWhen: stepCountIs(MERCHANT_TOOL_STEP_LIMIT),
		});
	}

	return merchantAgentSingleton;
}

async function isValidAgentThread(ctx: ActionCtx, threadId: string) {
	try {
		const thread = await ctx.runQuery(components.agent.threads.getThread, {
			threadId,
		});

		return Boolean(thread);
	} catch {
		return false;
	}
}

function buildAgentUserId(args: { actorId: string; shopId: Id<"shops"> }) {
	return `merchant:${args.shopId}:${args.actorId}`;
}

async function ensureThreadState(
	ctx: ActionCtx,
	args: {
		actorId: string;
		conversationId: Id<"merchantCopilotConversations">;
		shopDomain: string;
		shopId: Id<"shops">;
	},
): Promise<MerchantThreadState> {
	const existingConversation = await ctx.runQuery(
		internal.merchantWorkspace.getConversationThreadState,
		{
			conversationId: args.conversationId,
		},
	);
	let threadId =
		existingConversation?.threadId && (await isValidAgentThread(ctx, existingConversation.threadId))
			? existingConversation.threadId
			: null;

	if (!threadId) {
		const created = await getMerchantAgent().createThread(
			{
				...ctx,
				actorId: args.actorId,
				shopDomain: args.shopDomain,
				shopId: args.shopId,
			},
			{
				title: `Merchant copilot ${args.shopDomain}`,
				userId: buildAgentUserId({
					actorId: args.actorId,
					shopId: args.shopId,
				}),
			},
		);
		threadId = created.threadId;
		await ctx.runMutation(internal.merchantWorkspace.setConversationThread, {
			conversationId: args.conversationId,
			threadId,
		});
	}

	return {
		conversationId: args.conversationId,
		threadId,
	};
}

function buildSystemInstructions() {
	return [
		"You are the merchant copilot for a Shopify operations console.",
		"Stay focused on merchant operations: catalog, inventory, orders, workflows, and merchant knowledge documents.",
		"Use tools before making store-specific factual claims.",
		"Never mutate Shopify directly.",
		"All Shopify Admin changes must be staged through approval tools.",
		"Only the dedicated workflow tool may run immediate actions, and only for low-risk background workflow types.",
		"If product, variant, or location targeting is ambiguous, stop and ask for clarification through the available tool flows.",
		"Prefer exact product handles or titles when resolving targets.",
		"Keep answers concise and operational.",
		"Do not invent citations, metrics, inventory counts, workflow state, or document content.",
	].join(" ");
}

function extractArtifacts(toolResults: Array<{ output: unknown; toolName: string }>) {
	const artifacts: MerchantArtifact[] = [];
	const toolNames: string[] = [];

	for (const toolResult of toolResults) {
		toolNames.push(toolResult.toolName);

		if (
			toolResult.output &&
			typeof toolResult.output === "object" &&
			"artifact" in toolResult.output &&
			(toolResult.output as ToolArtifactEnvelope).artifact
		) {
			artifacts.push((toolResult.output as ToolArtifactEnvelope).artifact!);
		}
	}

	return {
		artifacts,
		toolNames: Array.from(new Set(toolNames)),
	};
}

function chooseArtifact(artifacts: MerchantArtifact[]) {
	const priority: MerchantArtifact["kind"][] = [
		"approval",
		"workflow",
		"clarification",
		"dashboard",
		"answer",
	];

	for (const kind of priority) {
		const candidates = artifacts.filter((artifact) => artifact.kind === kind);

		if (candidates.length > 0) {
			return candidates[candidates.length - 1]!;
		}
	}

	return null;
}

function buildInstallHealthArtifact(shopDomain: string, message: string): MerchantArtifact {
	return {
		body: `${message} Re-run embedded bootstrap from Shopify admin after reinstalling the app if needed.`,
		citations: [
			buildShopifyCitation(
				"Install health",
				`Shop ${shopDomain} is not currently in a connected embedded-admin state.`,
			),
		],
		kind: "answer",
	};
}

function buildTools(
	agentCtx: MerchantAgentCtx,
	conversationId: Id<"merchantCopilotConversations">,
) {
	return {
		inspectOverview: createTool<
			{
				windowDays: number | null;
			},
			{
				artifact: MerchantArtifact;
				orderCount: number;
				revenueTotal: number;
				windowDays: number;
			},
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description: "Inspect merchant overview metrics, low-stock risk, and recent sales trends.",
			execute: async (ctx, input) => {
				const windowDays = input.windowDays ?? DEFAULT_ANALYTICS_WINDOW_DAYS;
				const snapshot = await ctx.runAction(
					internal.merchantWorkspace.getOverviewSnapshotInternal,
					{
						actorId: ctx.actorId,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
						windowDays,
					},
				);

				return {
					artifact: {
						body: `The last ${windowDays} day(s) show ${snapshot.orderCount} order(s) totaling ${formatMoney(snapshot.revenueTotal, snapshot.revenueCurrency)}. I refreshed the operating dashboard from grounded Shopify data.`,
						citations: snapshot.citations,
						dashboard: snapshot.dashboard,
						kind: "dashboard",
					},
					orderCount: snapshot.orderCount,
					revenueTotal: snapshot.revenueTotal,
					windowDays,
				};
			},
			inputSchema: z.object({
				windowDays: z.number().int().min(1).max(90).nullable(),
			}),
			strict: true,
		}),
		searchProducts: createTool<
			{
				limit: number | null;
				query: string;
			},
			{
				artifact: MerchantArtifact;
				candidates: ProductCandidate[];
			},
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description: "Search Shopify products for merchant operations work.",
			execute: async (ctx, input) => {
				const rows = await ctx.runAction(
					internal.merchantWorkspace.searchProductsSnapshotInternal,
					{
						query: input.query,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				);
				const candidates = rows
					.map(toProductCandidate)
					.filter((candidate: ProductCandidate | null): candidate is ProductCandidate =>
						Boolean(candidate),
					)
					.slice(0, input.limit ?? PRODUCT_CANDIDATE_LIMIT);

				if (candidates.length === 0) {
					return {
						artifact: {
							body: `I couldn't find a Shopify product match for "${input.query}". Try an exact title or handle.`,
							citations: [
								buildShopifyCitation(
									"Product search",
									`No product matched the query "${input.query}".`,
								),
							],
							kind: "answer",
						},
						candidates,
					};
				}

				return {
					artifact: {
						body: `I found ${candidates.length} product match(es) for "${input.query}".`,
						citations: [
							buildShopifyCitation(
								"Product search",
								`${candidates.length} candidate product(s) matched the query "${input.query}".`,
							),
						],
						dashboard: buildProductsDashboard(
							"Product matches",
							"Candidate product matches for the current merchant request.",
							candidates,
						),
						kind: "dashboard",
					},
					candidates,
				};
			},
			inputSchema: z.object({
				limit: z.number().int().min(1).max(6).nullable(),
				query: z.string().min(1).max(200),
			}),
			strict: true,
		}),
		searchOrders: createTool<
			{
				query: string | null;
				windowDays: number | null;
			},
			{
				artifact: MerchantArtifact;
				orders: OrderSnapshot[];
				windowDays: number;
			},
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description: "Search recent Shopify orders for merchant analytics and operations questions.",
			execute: async (ctx, input) => {
				const windowDays = input.windowDays ?? DEFAULT_ANALYTICS_WINDOW_DAYS;
				const orders = await ctx.runAction(
					internal.merchantWorkspace.searchOrdersSnapshotInternal,
					{
						query: input.query ?? undefined,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
						windowDays,
					},
				);

				return {
					artifact: {
						body: orders.length
							? `I found ${orders.length} order row(s) in the last ${windowDays} day(s).`
							: `I didn't find any matching orders in the last ${windowDays} day(s).`,
						citations: [
							buildShopifyCitation(
								"Order search",
								`${orders.length} order result(s) were considered for the requested window.`,
							),
						],
						dashboard: buildOrdersDashboard(
							"Order matches",
							"Recent order rows returned for the merchant request.",
							orders,
							windowDays,
						),
						kind: "dashboard",
					},
					orders,
					windowDays,
				};
			},
			inputSchema: z.object({
				query: z.string().min(1).max(200).nullable(),
				windowDays: z.number().int().min(1).max(90).nullable(),
			}),
			strict: true,
		}),
		searchDocuments: createTool<
			{
				limit: number | null;
				query: string;
			},
			{
				artifact: MerchantArtifact;
				matches: RetrievedKnowledgeMatch[];
			},
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description: "Search merchant-private and public knowledge documents for grounded answers.",
			execute: async (ctx, input) => {
				const matches = (await ctx.runAction(internal.merchantDocumentsNode.retrieveKnowledge, {
					audience: "merchant",
					limit: input.limit ?? 6,
					query: input.query,
					shopId: ctx.shopId,
				})) as RetrievedKnowledgeMatch[];

				if (matches.length === 0) {
					return {
						artifact: {
							body: `I couldn't find a merchant document match for "${input.query}".`,
							citations: [
								buildShopifyCitation(
									"Knowledge search",
									`No merchant document chunk matched "${input.query}".`,
								),
							],
							kind: "answer",
						},
						matches,
					};
				}

				return {
					artifact: {
						body: `I found ${matches.length} document match(es). The strongest excerpts are: ${matches
							.slice(0, 3)
							.map((match) => match.snippet)
							.join(" ")}`,
						citations: matches.slice(0, 4).map((match) => match.citation),
						dashboard: buildDocumentMatchesDashboard(matches),
						kind: "dashboard",
					},
					matches,
				};
			},
			inputSchema: z.object({
				limit: z.number().int().min(1).max(6).nullable(),
				query: z.string().min(2).max(300),
			}),
			strict: true,
		}),
		inspectWorkflows: createTool<
			{
				limit: number | null;
			},
			{
				artifact: MerchantArtifact;
			},
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description: "Inspect recent workflow and audit activity for merchant operations.",
			execute: async (ctx, input) => {
				const workflowData = await ctx.runQuery(api.merchantWorkspace.workflows, {});
				const audits = await ctx.runQuery(internal.merchantWorkspace.getRecentAuditRows, {
					shopId: ctx.shopId,
				});
				const workflowLimit = input.limit ?? 6;
				const workflowRows = workflowData.records.slice(0, workflowLimit);
				const auditRows = audits
					.slice(0, workflowLimit)
					.map(
						(audit: {
							action: string;
							createdAt: number;
							detail?: string | null;
							status?: string;
						}) => ({
							action: audit.action,
							created_at: new Date(audit.createdAt).toISOString(),
							detail: audit.detail ?? null,
							status: audit.status ?? null,
						}),
					);

				return {
					artifact: {
						body: `I inspected ${workflowRows.length} workflow row(s) and ${auditRows.length} audit row(s) for the current shop.`,
						citations: [
							buildWorkflowCitation(
								"Workflow inspection",
								`${workflowRows.length} recent workflow row(s) were reviewed.`,
							),
						],
						dashboard: buildWorkflowsDashboard(workflowRows, auditRows),
						kind: "dashboard",
					},
				};
			},
			inputSchema: z.object({
				limit: z.number().int().min(1).max(10).nullable(),
			}),
			strict: true,
		}),
		getProductContext: createTool<
			{
				query: string;
			},
			{
				artifact?: MerchantArtifact;
				candidates: ProductCandidate[];
				locations: LocationCandidate[];
				product: ProductContextSnapshot["product"] | null;
				resolution: "ambiguous" | "exact" | "not_found";
				variants: VariantCandidate[];
			},
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description:
				"Resolve a Shopify product and load the full merchant edit context, including variants and locations.",
			execute: async (ctx, input) => {
				const rows = await ctx.runAction(
					internal.merchantWorkspace.searchProductsSnapshotInternal,
					{
						query: input.query,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				);
				const resolution = resolveExactProduct(input.query, rows);

				if (resolution.status !== "exact" || !resolution.match) {
					return {
						artifact: {
							body:
								resolution.status === "not_found"
									? `I couldn't find a product for "${input.query}". Try the exact title or handle.`
									: `I found multiple product matches for "${input.query}". Reply with the exact title or handle so I stage the right change.`,
							citations: [
								buildShopifyCitation(
									"Product resolution",
									resolution.status === "not_found"
										? `No exact product could be resolved from "${input.query}".`
										: `${resolution.candidates.length} product candidates need disambiguation.`,
								),
							],
							dashboard:
								resolution.candidates.length > 0
									? buildProductsDashboard(
											"Product clarification needed",
											"Choose the exact product title or handle before I stage a write.",
											resolution.candidates,
										)
									: undefined,
							kind: "clarification",
						},
						candidates: resolution.candidates,
						locations: [],
						product: null,
						resolution: resolution.status,
						variants: [],
					};
				}

				const context = (await ctx.runAction(
					internal.merchantWorkspace.getProductEditContextInternal,
					{
						productId: resolution.match.id,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				)) as ProductContextSnapshot;

				return {
					candidates: resolution.candidates,
					locations: toLocationCandidates(context),
					product: context.product ?? null,
					resolution: "exact" as const,
					variants: toVariantCandidates(context),
				};
			},
			inputSchema: z.object({
				query: z.string().min(1).max(200),
			}),
			strict: true,
		}),
		draftProductStatusChange: createTool<
			{
				productQuery: string;
				status: "ACTIVE" | "ARCHIVED" | "DRAFT";
			},
			ToolArtifactEnvelope,
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description: "Stage an approval to change product status.",
			execute: async (ctx, input) => {
				const rows = await ctx.runAction(
					internal.merchantWorkspace.searchProductsSnapshotInternal,
					{
						query: input.productQuery,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				);
				const resolution = resolveExactProduct(input.productQuery, rows);

				if (resolution.status !== "exact" || !resolution.match) {
					return {
						artifact: {
							body:
								resolution.status === "not_found"
									? `I couldn't find a product to update for "${input.productQuery}".`
									: `I found multiple product matches for "${input.productQuery}". Reply with the exact title or handle so I stage the correct status change.`,
							citations: [
								buildShopifyCitation(
									"Product resolution",
									resolution.status === "not_found"
										? `No exact product could be resolved from "${input.productQuery}".`
										: `${resolution.candidates.length} product candidates require disambiguation.`,
								),
							],
							dashboard:
								resolution.candidates.length > 0
									? buildProductsDashboard(
											"Product clarification needed",
											"Choose the exact product before I stage a status change.",
											resolution.candidates,
										)
									: undefined,
							kind: "clarification",
						},
					};
				}

				const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
					actorId: ctx.actorId,
					conversationId,
					plannedChangesJson: JSON.stringify([
						approvalPlannedChange("Product status", resolution.match.status, input.status),
					]),
					requestPayload: {
						productId: resolution.match.id,
						productTitle: resolution.match.title,
						status: input.status,
						tool: "updateProductStatus",
					},
					riskSummary:
						input.status === "ACTIVE"
							? "Publishing changes visibility across sales channels."
							: "Drafting or archiving can hide the product from merchant flows and storefront shoppers.",
					shopDomain: ctx.shopDomain,
					shopId: ctx.shopId,
					summary: `Update ${resolution.match.title} to status ${input.status}.`,
					targetId: resolution.match.id,
					targetLabel: resolution.match.title,
					targetType: "product",
					tool: "updateProductStatus",
				});

				return {
					artifact: {
						approvalIds: [approvalId],
						body: `I prepared a status-change approval for ${resolution.match.title}. Nothing has been written to Shopify yet.`,
						citations: [
							buildApprovalCitation(
								"Approval drafted",
								`Status change staged for ${resolution.match.title}.`,
							),
						],
						kind: "approval",
					},
				};
			},
			inputSchema: z.object({
				productQuery: z.string().min(1).max(200),
				status: z.enum(["ACTIVE", "ARCHIVED", "DRAFT"]),
			}),
			strict: true,
		}),
		draftTagUpdate: createTool<
			{
				mode: "add" | "remove";
				productQuery: string;
				tags: string[];
			},
			ToolArtifactEnvelope,
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description: "Stage an approval to add or remove product tags.",
			execute: async (ctx, input) => {
				const rows = await ctx.runAction(
					internal.merchantWorkspace.searchProductsSnapshotInternal,
					{
						query: input.productQuery,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				);
				const resolution = resolveExactProduct(input.productQuery, rows);

				if (resolution.status !== "exact" || !resolution.match) {
					return {
						artifact: {
							body:
								resolution.status === "not_found"
									? `I couldn't find a product to tag for "${input.productQuery}".`
									: `I found multiple product matches for "${input.productQuery}". Reply with the exact title or handle so I stage the right tag update.`,
							citations: [
								buildShopifyCitation(
									"Product resolution",
									resolution.status === "not_found"
										? `No exact product could be resolved from "${input.productQuery}".`
										: `${resolution.candidates.length} product candidates require disambiguation.`,
								),
							],
							dashboard:
								resolution.candidates.length > 0
									? buildProductsDashboard(
											"Product clarification needed",
											"Choose the exact product before I stage a tag change.",
											resolution.candidates,
										)
									: undefined,
							kind: "clarification",
						},
					};
				}

				const tags = input.tags
					.map((tag) => tag.trim())
					.filter(Boolean)
					.slice(0, 8);

				if (tags.length === 0) {
					return {
						artifact: {
							body: "I need at least one non-empty tag before I can stage that update.",
							citations: [],
							kind: "answer",
						},
					};
				}

				const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
					actorId: ctx.actorId,
					conversationId,
					plannedChangesJson: JSON.stringify(
						tags.map((tag) =>
							approvalPlannedChange(
								`Tag ${input.mode}`,
								input.mode === "remove" ? tag : null,
								input.mode === "add" ? tag : null,
							),
						),
					),
					requestPayload: {
						mode: input.mode,
						productId: resolution.match.id,
						productTitle: resolution.match.title,
						tags,
						tool: "updateProductTags",
					},
					riskSummary:
						"Tag changes affect merchant search, merchandising rules, and downstream automations keyed on tags.",
					shopDomain: ctx.shopDomain,
					shopId: ctx.shopId,
					summary: `${input.mode === "add" ? "Add" : "Remove"} ${tags.length} tag(s) on ${resolution.match.title}.`,
					targetId: resolution.match.id,
					targetLabel: resolution.match.title,
					targetType: "product",
					tool: "updateProductTags",
				});

				return {
					artifact: {
						approvalIds: [approvalId],
						body: `I prepared a tag update for ${resolution.match.title} with ${tags.join(", ")}. Review the approval card before Shopify is mutated.`,
						citations: [
							buildApprovalCitation(
								"Approval drafted",
								`Tag update staged for ${resolution.match.title}.`,
							),
						],
						kind: "approval",
					},
				};
			},
			inputSchema: z.object({
				mode: z.enum(["add", "remove"]),
				productQuery: z.string().min(1).max(200),
				tags: z.array(z.string().min(1).max(80)).min(1).max(8),
			}),
			strict: true,
		}),
		draftProductContentUpdate: createTool<
			{
				descriptionHtml: string | null;
				productQuery: string;
				title: string | null;
			},
			ToolArtifactEnvelope,
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description: "Stage an approval to update product title or description.",
			execute: async (ctx, input) => {
				const rows = await ctx.runAction(
					internal.merchantWorkspace.searchProductsSnapshotInternal,
					{
						query: input.productQuery,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				);
				const resolution = resolveExactProduct(input.productQuery, rows);

				if (resolution.status !== "exact" || !resolution.match) {
					return {
						artifact: {
							body:
								resolution.status === "not_found"
									? `I couldn't find a product to rewrite for "${input.productQuery}".`
									: `I found multiple product matches for "${input.productQuery}". Reply with the exact title or handle so I stage the right content update.`,
							citations: [
								buildShopifyCitation(
									"Product resolution",
									resolution.status === "not_found"
										? `No exact product could be resolved from "${input.productQuery}".`
										: `${resolution.candidates.length} product candidates require disambiguation.`,
								),
							],
							dashboard:
								resolution.candidates.length > 0
									? buildProductsDashboard(
											"Product clarification needed",
											"Choose the exact product before I stage a content change.",
											resolution.candidates,
										)
									: undefined,
							kind: "clarification",
						},
					};
				}

				const context = (await ctx.runAction(
					internal.merchantWorkspace.getProductEditContextInternal,
					{
						productId: resolution.match.id,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				)) as ProductContextSnapshot;
				const title = input.title?.trim() || null;
				const descriptionHtml = input.descriptionHtml?.trim() || null;

				if (!title && !descriptionHtml) {
					return {
						artifact: {
							body: "I need proposed title or description copy before I can stage that content update.",
							citations: [],
							kind: "answer",
						},
					};
				}

				const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
					actorId: ctx.actorId,
					conversationId,
					plannedChangesJson: JSON.stringify(
						[
							title ? approvalPlannedChange("Title", context.product?.title ?? null, title) : null,
							descriptionHtml
								? approvalPlannedChange(
										"Description",
										context.product?.descriptionHtml ?? null,
										descriptionHtml,
									)
								: null,
						].filter(Boolean),
					),
					requestPayload: {
						descriptionHtml: descriptionHtml ?? undefined,
						productId: resolution.match.id,
						productTitle: resolution.match.title,
						title: title ?? undefined,
						tool: "updateProductContent",
					},
					riskSummary:
						"Content changes can affect storefront conversion, SEO, and downstream product feeds.",
					shopDomain: ctx.shopDomain,
					shopId: ctx.shopId,
					summary: `Update core content on ${resolution.match.title}.`,
					targetId: resolution.match.id,
					targetLabel: resolution.match.title,
					targetType: "product",
					tool: "updateProductContent",
				});

				return {
					artifact: {
						approvalIds: [approvalId],
						body: `I prepared a content update approval for ${resolution.match.title}. Review the before/after copy before execution.`,
						citations: [
							buildApprovalCitation(
								"Approval drafted",
								`Content update staged for ${resolution.match.title}.`,
							),
						],
						kind: "approval",
					},
				};
			},
			inputSchema: z.object({
				descriptionHtml: z.string().min(1).max(4000).nullable(),
				productQuery: z.string().min(1).max(200),
				title: z.string().min(1).max(255).nullable(),
			}),
			strict: true,
		}),
		draftProductMetafieldUpdate: createTool<
			{
				key: string;
				namespace: string;
				productQuery: string;
				value: string;
			},
			ToolArtifactEnvelope,
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description: "Stage an approval to set a product metafield value.",
			execute: async (ctx, input) => {
				const rows = await ctx.runAction(
					internal.merchantWorkspace.searchProductsSnapshotInternal,
					{
						query: input.productQuery,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				);
				const resolution = resolveExactProduct(input.productQuery, rows);

				if (resolution.status !== "exact" || !resolution.match) {
					return {
						artifact: {
							body:
								resolution.status === "not_found"
									? `I couldn't find a product for the ${input.namespace}.${input.key} metafield update.`
									: `I found multiple product matches for "${input.productQuery}". Reply with the exact title or handle so I stage the correct metafield update.`,
							citations: [
								buildShopifyCitation(
									"Product resolution",
									resolution.status === "not_found"
										? `No exact product could be resolved from "${input.productQuery}".`
										: `${resolution.candidates.length} product candidates require disambiguation.`,
								),
							],
							dashboard:
								resolution.candidates.length > 0
									? buildProductsDashboard(
											"Product clarification needed",
											"Choose the exact product before I stage a metafield change.",
											resolution.candidates,
										)
									: undefined,
							kind: "clarification",
						},
					};
				}

				const context = (await ctx.runAction(
					internal.merchantWorkspace.getProductEditContextInternal,
					{
						productId: resolution.match.id,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				)) as ProductContextSnapshot;
				const existingField = context.product?.metafields?.nodes?.find((field) => {
					return field?.namespace === input.namespace && field.key === input.key;
				});
				const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
					actorId: ctx.actorId,
					conversationId,
					plannedChangesJson: JSON.stringify([
						approvalPlannedChange(
							`${input.namespace}.${input.key}`,
							existingField?.value ?? null,
							input.value,
						),
					]),
					requestPayload: {
						metafields: [
							{
								compareDigest: existingField?.compareDigest ?? null,
								key: input.key,
								namespace: input.namespace,
								type: existingField?.type ?? "single_line_text_field",
								value: input.value,
							},
						],
						productId: resolution.match.id,
						productTitle: resolution.match.title,
						tool: "updateProductMetafields",
					},
					riskSummary:
						"Metafield writes can affect storefront themes, app logic, and downstream automations that depend on this namespace.",
					shopDomain: ctx.shopDomain,
					shopId: ctx.shopId,
					summary: `Set metafield ${input.namespace}.${input.key} on ${resolution.match.title}.`,
					targetId: resolution.match.id,
					targetLabel: resolution.match.title,
					targetType: "product",
					tool: "updateProductMetafields",
				});

				return {
					artifact: {
						approvalIds: [approvalId],
						body: `I prepared a metafield update for ${resolution.match.title} under ${input.namespace}.${input.key}. Review the approval card for the exact value before execution.`,
						citations: [
							buildApprovalCitation(
								"Approval drafted",
								`Metafield update staged for ${resolution.match.title}.`,
							),
						],
						kind: "approval",
					},
				};
			},
			inputSchema: z.object({
				key: z.string().min(1).max(80),
				namespace: z.string().min(1).max(80),
				productQuery: z.string().min(1).max(200),
				value: z.string().min(1).max(1000),
			}),
			strict: true,
		}),
		draftInventoryAdjustment: createTool<
			{
				delta: number;
				locationQuery: string | null;
				productQuery: string;
				variantQuery: string | null;
			},
			ToolArtifactEnvelope,
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description:
				"Stage an approval to adjust tracked inventory for an exact variant and location.",
			execute: async (ctx, input) => {
				const rows = await ctx.runAction(
					internal.merchantWorkspace.searchProductsSnapshotInternal,
					{
						query: input.productQuery,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				);
				const resolution = resolveExactProduct(input.productQuery, rows);

				if (resolution.status !== "exact" || !resolution.match) {
					return {
						artifact: {
							body:
								resolution.status === "not_found"
									? `I couldn't find a product to adjust for "${input.productQuery}".`
									: `I found multiple product matches for "${input.productQuery}". Reply with the exact title or handle so I stage the correct inventory change.`,
							citations: [
								buildShopifyCitation(
									"Product resolution",
									resolution.status === "not_found"
										? `No exact product could be resolved from "${input.productQuery}".`
										: `${resolution.candidates.length} product candidates require disambiguation.`,
								),
							],
							dashboard:
								resolution.candidates.length > 0
									? buildProductsDashboard(
											"Product clarification needed",
											"Choose the exact product before I stage an inventory change.",
											resolution.candidates,
										)
									: undefined,
							kind: "clarification",
						},
					};
				}

				const context = (await ctx.runAction(
					internal.merchantWorkspace.getProductEditContextInternal,
					{
						productId: resolution.match.id,
						shopDomain: ctx.shopDomain,
						shopId: ctx.shopId,
					},
				)) as ProductContextSnapshot;
				const variants = toVariantCandidates(context);
				const locations = toLocationCandidates(context);
				const variantResolution = resolveVariant(input.variantQuery, variants);
				const locationResolution = resolveLocation(input.locationQuery, locations);

				if (variantResolution.status !== "exact" || !variantResolution.match) {
					return {
						artifact: {
							body:
								variantResolution.status === "not_found"
									? `I couldn't resolve a tracked variant on ${resolution.match.title}.`
									: `I need the exact variant title, SKU, or id before I stage that inventory adjustment on ${resolution.match.title}.`,
							citations: [
								buildShopifyCitation(
									"Variant resolution",
									variantResolution.status === "not_found"
										? `No tracked variant could be resolved on ${resolution.match.title}.`
										: `${variants.length} variants are available on ${resolution.match.title}.`,
								),
							],
							dashboard:
								variants.length > 0
									? buildClarificationDashboard(
											"Variant clarification needed",
											"Choose the exact variant before I stage an inventory adjustment.",
											["title", "sku", "inventory", "tracked"],
											variants.map((variant) => ({
												inventory: variant.inventoryQuantity,
												sku: variant.sku,
												title: variant.title,
												tracked: variant.tracked ? "yes" : "no",
											})),
										)
									: undefined,
							kind: "clarification",
						},
					};
				}

				if (!variantResolution.match.inventoryItemId || !variantResolution.match.tracked) {
					return {
						artifact: {
							body: `The resolved variant on ${resolution.match.title} is not a tracked inventory item, so I didn't stage a write.`,
							citations: [
								buildShopifyCitation(
									"Inventory context",
									`${variantResolution.match.title} is not tracked inventory.`,
								),
							],
							kind: "answer",
						},
					};
				}

				if (locationResolution.status !== "exact" || !locationResolution.match) {
					return {
						artifact: {
							body:
								locationResolution.status === "not_found"
									? `I couldn't resolve a location for ${resolution.match.title}.`
									: `I need the exact location name or id before I stage that inventory adjustment on ${resolution.match.title}.`,
							citations: [
								buildShopifyCitation(
									"Location resolution",
									locationResolution.status === "not_found"
										? `No active location could be resolved for ${resolution.match.title}.`
										: `${locations.length} candidate location(s) are available for ${resolution.match.title}.`,
								),
							],
							dashboard:
								locations.length > 0
									? buildClarificationDashboard(
											"Location clarification needed",
											"Choose the exact location before I stage an inventory adjustment.",
											["name", "active", "id"],
											locations.map((location) => ({
												active: location.isActive ? "yes" : "no",
												id: location.id,
												name: location.name,
											})),
										)
									: undefined,
							kind: "clarification",
						},
					};
				}

				const approvalId = await ctx.runMutation(internal.merchantWorkspace.createApprovalRequest, {
					actorId: ctx.actorId,
					conversationId,
					plannedChangesJson: JSON.stringify([
						approvalPlannedChange(
							`${variantResolution.match.title} available delta`,
							`${variantResolution.match.inventoryQuantity}`,
							`${input.delta > 0 ? "+" : ""}${input.delta}`,
						),
					]),
					requestPayload: {
						delta: input.delta,
						locationId: locationResolution.match.id,
						locationName: locationResolution.match.name,
						productTitle: resolution.match.title,
						reason: "correction",
						referenceDocumentUri: `gid://growth-capital-shopify-ai/InventoryAdjustment/${Date.now()}`,
						tool: "adjustInventory",
						variantId: variantResolution.match.id,
						variantInventoryItemId: variantResolution.match.inventoryItemId,
						variantTitle: variantResolution.match.title,
					},
					riskSummary:
						"Inventory adjustments immediately affect merchant inventory history and downstream availability decisions.",
					shopDomain: ctx.shopDomain,
					shopId: ctx.shopId,
					summary: `Adjust inventory on ${resolution.match.title} by ${input.delta}.`,
					targetId: variantResolution.match.id,
					targetLabel: `${resolution.match.title} · ${variantResolution.match.title}`,
					targetType: "inventory",
					tool: "adjustInventory",
				});

				return {
					artifact: {
						approvalIds: [approvalId],
						body: `I prepared an inventory adjustment approval for ${resolution.match.title} at ${locationResolution.match.name}.`,
						citations: [
							buildApprovalCitation(
								"Approval drafted",
								`Inventory adjustment staged for ${resolution.match.title}.`,
							),
						],
						kind: "approval",
					},
				};
			},
			inputSchema: z.object({
				delta: z.number().int().min(-9999).max(9999),
				locationQuery: z.string().min(1).max(200).nullable(),
				productQuery: z.string().min(1).max(200),
				variantQuery: z.string().min(1).max(200).nullable(),
			}),
			strict: true,
		}),
		runSafeWorkflow: createTool<
			{
				workflowType: WorkflowType;
			},
			ToolArtifactEnvelope,
			MerchantAgentCtx
		>({
			ctx: agentCtx,
			description:
				"Queue a low-risk background merchant workflow immediately. Do not use this for Shopify Admin writes.",
			execute: async (ctx, input) => {
				const workflowType = workflowTypeSchema.parse(input.workflowType);
				const jobId = await ctx.runMutation(internal.shopifySync.queueSyncJob, {
					domain: ctx.shopDomain,
					payloadPreview: `Merchant requested ${workflowType}.`,
					pendingReason: `Merchant copilot queued ${workflowType}.`,
					shopId: ctx.shopId,
					source: "merchant_copilot",
					type: workflowType,
				});
				await ctx.runMutation(internal.merchantWorkspace.recordAuditLog, {
					action: `merchant.workflow.${workflowType}.queued`,
					actorId: ctx.actorId,
					detail: `Queued ${formatWorkflowTitle(workflowType)} from merchant copilot.`,
					payload: {
						jobId,
						type: workflowType,
					},
					shopId: ctx.shopId,
					status: "success",
				});

				return {
					artifact: {
						body: `I queued ${formatWorkflowTitle(workflowType).toLowerCase()} immediately. You can track it in Workflows.`,
						citations: [
							buildWorkflowCitation(
								"Workflow queued",
								`${formatWorkflowTitle(workflowType)} was queued directly from merchant copilot.`,
							),
						],
						kind: "workflow",
					},
				};
			},
			inputSchema: z.object({
				workflowType: workflowTypeSchema,
			}),
			strict: true,
		}),
	} satisfies ToolSet;
}

export async function runMerchantCopilotTurn(
	ctx: ActionCtx,
	args: MerchantCopilotRuntimeArgs,
): Promise<MerchantCopilotConversation> {
	const prompt = args.prompt.trim();

	if (prompt.length < 4) {
		throw new Error("Ask a more specific merchant question so the copilot can ground the answer.");
	}

	const claims = await requireMerchantClaims(ctx);
	const runtime = await ctx.runQuery(internal.merchantWorkspace.getRuntimeStateInternal, {
		actorId: claims.actorId,
		shopDomain: claims.shopDomain,
		shopId: claims.shopId,
	});
	const conversationId =
		args.conversationId ??
		(await ctx.runMutation(internal.merchantWorkspace.ensureConversation, {
			actorId: runtime.actor.id,
			promptPreview: sanitizePromptPreview(prompt),
			shopId: runtime.shop._id,
		}));

	await ctx.runMutation(internal.merchantWorkspace.appendCopilotMessage, {
		actorId: runtime.actor.id,
		body: prompt,
		conversationId,
		role: "user",
		shopId: runtime.shop._id,
		toolNames: [],
	});

	const accessFailure = getShopifyAccessFailureReason({
		actionLabel: "use the merchant copilot",
		installation: runtime.installation,
		shop: runtime.shop,
	});

	if (accessFailure) {
		const artifact = buildInstallHealthArtifact(runtime.shop.domain, accessFailure);
		await ctx.runMutation(internal.merchantWorkspace.appendCopilotMessage, {
			actorId: runtime.actor.id,
			body: artifact.body,
			citationsJson: JSON.stringify(artifact.citations),
			conversationId,
			role: "assistant",
			shopId: runtime.shop._id,
			toolNames: [],
		});

		return await ctx.runQuery(internal.merchantWorkspace.getConversationStateInternal, {
			actorId: runtime.actor.id,
			conversationId,
			shopId: runtime.shop._id,
		});
	}

	try {
		const threadState = await ensureThreadState(ctx, {
			actorId: runtime.actor.id,
			conversationId,
			shopDomain: runtime.shop.domain,
			shopId: runtime.shop._id,
		});
		const agentCtx = {
			...ctx,
			actorId: runtime.actor.id,
			shopDomain: runtime.shop.domain,
			shopId: runtime.shop._id,
		} satisfies MerchantAgentCtx;
		const { thread } = await getMerchantAgent().continueThread(agentCtx, {
			threadId: threadState.threadId,
			userId: buildAgentUserId({
				actorId: runtime.actor.id,
				shopId: runtime.shop._id,
			}),
		});
		const result = await thread.streamText(
			{
				prompt,
				system: buildSystemInstructions(),
				tools: buildTools(agentCtx, conversationId),
			},
			{
				contextOptions: {
					excludeToolMessages: true,
					recentMessages: 8,
				},
				storageOptions: {
					saveMessages: "all",
				},
			},
		);

		for await (const _part of result.fullStream) {
			// Merchant chat is request/response today, so we only need the completed tool outputs.
		}

		const answerText = (await result.text).trim();
		const steps = await result.steps;
		const outputs = extractArtifacts(
			steps.flatMap((step) => step.toolResults) as Array<{
				output: unknown;
				toolName: string;
			}>,
		);
		const artifact = chooseArtifact(outputs.artifacts);
		const body = (artifact?.body ?? answerText) || "I need a narrower merchant request to proceed.";

		await ctx.runMutation(internal.merchantWorkspace.appendCopilotMessage, {
			actorId: runtime.actor.id,
			approvalIds: artifact?.kind === "approval" ? artifact.approvalIds : undefined,
			body,
			citationsJson:
				artifact && artifact.citations.length > 0 ? JSON.stringify(artifact.citations) : undefined,
			conversationId,
			dashboardSpecJson: artifact?.dashboard ? JSON.stringify(artifact.dashboard) : undefined,
			role: "assistant",
			shopId: runtime.shop._id,
			toolNames: outputs.toolNames,
		});
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "The merchant copilot could not complete that request.";
		await ctx.runMutation(internal.merchantWorkspace.appendCopilotMessage, {
			actorId: runtime.actor.id,
			body: message,
			conversationId,
			role: "assistant",
			shopId: runtime.shop._id,
			toolNames: [],
		});
	}

	return await ctx.runQuery(internal.merchantWorkspace.getConversationStateInternal, {
		actorId: runtime.actor.id,
		conversationId,
		shopId: runtime.shop._id,
	});
}
