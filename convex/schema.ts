import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const storefrontPolicyAnswersValidator = v.object({
	contact: v.string(),
	returns: v.string(),
	shipping: v.string(),
});

const storefrontReferenceValidator = v.object({
	label: v.string(),
	url: v.optional(v.string()),
});

const storefrontProductCardValidator = v.object({
	availabilityLabel: v.string(),
	handle: v.string(),
	href: v.string(),
	kind: v.literal("product"),
	priceLabel: v.string(),
	summary: v.string(),
	title: v.string(),
	vendor: v.union(v.string(), v.null()),
});

const storefrontCollectionCardValidator = v.object({
	handle: v.string(),
	href: v.string(),
	kind: v.literal("collection"),
	productCount: v.union(v.number(), v.null()),
	summary: v.string(),
	title: v.string(),
});

const storefrontCartPlanItemValidator = v.object({
	productHandle: v.string(),
	productTitle: v.string(),
	productUrl: v.string(),
	quantity: v.number(),
	variantId: v.string(),
	variantTitle: v.string(),
});

const storefrontCartPlanValidator = v.object({
	explanation: v.optional(v.string()),
	items: v.array(storefrontCartPlanItemValidator),
	note: v.optional(v.string()),
});

const storefrontWidgetReplyValidator = v.object({
	answer: v.string(),
	cards: v.array(v.union(storefrontProductCardValidator, storefrontCollectionCardValidator)),
	cartPlan: v.union(storefrontCartPlanValidator, v.null()),
	references: v.array(storefrontReferenceValidator),
	refusalReason: v.union(v.string(), v.null()),
	suggestedPrompts: v.array(v.string()),
	tone: v.union(v.literal("answer"), v.literal("refusal")),
});

export default defineSchema({
	auditLogs: defineTable({
		actorId: v.optional(v.string()),
		action: v.string(),
		createdAt: v.number(),
		detail: v.optional(v.string()),
		payload: v.optional(v.any()),
		shopId: v.optional(v.id("shops")),
		status: v.optional(v.string()),
	}).index("by_shop_created_at", ["shopId", "createdAt"]),

	merchantActors: defineTable({
		createdAt: v.number(),
		email: v.optional(v.string()),
		initials: v.string(),
		lastAuthenticatedAt: v.number(),
		name: v.string(),
		sessionId: v.optional(v.string()),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		shopifyUserId: v.string(),
	})
		.index("by_shop", ["shopId"])
		.index("by_shop_and_shopify_user_id", ["shopId", "shopifyUserId"]),

	shops: defineTable({
		createdAt: v.number(),
		domain: v.string(),
		installStatus: v.union(v.literal("pending"), v.literal("connected"), v.literal("inactive")),
		lastAuthenticatedAt: v.optional(v.number()),
		name: v.string(),
		planDisplayName: v.optional(v.string()),
		shopifyShopId: v.optional(v.string()),
	})
		.index("by_domain", ["domain"])
		.index("by_install_status", ["installStatus"]),

	shopifyInstallations: defineTable({
		accessToken: v.optional(v.string()),
		accessTokenExpiresAt: v.optional(v.number()),
		apiVersion: v.string(),
		createdAt: v.number(),
		domain: v.string(),
		lastTokenExchangeAt: v.optional(v.number()),
		refreshToken: v.optional(v.string()),
		refreshTokenExpiresAt: v.optional(v.number()),
		scopes: v.array(v.string()),
		shopId: v.id("shops"),
		status: v.union(
			v.literal("pending"),
			v.literal("connected"),
			v.literal("inactive"),
			v.literal("token_refresh_failed"),
		),
	})
		.index("by_domain", ["domain"])
		.index("by_shop", ["shopId"])
		.index("by_status", ["status"]),

	shopifyCacheStates: defineTable({
		cacheKey: v.string(),
		createdAt: v.number(),
		domain: v.string(),
		enabled: v.boolean(),
		lastCompletedAt: v.optional(v.number()),
		lastError: v.optional(v.string()),
		lastFailedAt: v.optional(v.number()),
		lastReconciledAt: v.optional(v.number()),
		lastRefreshedAt: v.optional(v.number()),
		lastRequestedAt: v.optional(v.number()),
		lastSourceUpdatedAt: v.optional(v.number()),
		lastStartedAt: v.optional(v.number()),
		lastWebhookAt: v.optional(v.number()),
		pendingReason: v.optional(v.string()),
		recordCount: v.optional(v.number()),
		shopId: v.id("shops"),
		staleAfterAt: v.optional(v.number()),
		status: v.string(),
		updatedAt: v.number(),
	})
		.index("by_shop_and_cache_key", ["shopId", "cacheKey"])
		.index("by_shop_and_updated_at", ["shopId", "updatedAt"])
		.index("by_status_and_updated_at", ["status", "updatedAt"]),

	shopifyCatalogProducts: defineTable({
		availableForSale: v.boolean(),
		currencyCode: v.optional(v.string()),
		domain: v.string(),
		featuredImageUrl: v.optional(v.string()),
		handle: v.string(),
		lastRefreshedAt: v.number(),
		maxPrice: v.optional(v.number()),
		minPrice: v.optional(v.number()),
		onlineStoreUrl: v.optional(v.string()),
		productType: v.optional(v.string()),
		publishedAt: v.optional(v.number()),
		searchText: v.string(),
		shopId: v.id("shops"),
		shopifyLegacyProductId: v.optional(v.string()),
		shopifyProductId: v.string(),
		sourceStatus: v.string(),
		sourceUpdatedAt: v.number(),
		summary: v.string(),
		tags: v.array(v.string()),
		title: v.string(),
		variantTitles: v.array(v.string()),
		variants: v.optional(
			v.array(
				v.object({
					availableForSale: v.boolean(),
					storefrontVariantId: v.string(),
					title: v.string(),
				}),
			),
		),
		vendor: v.optional(v.string()),
	})
		.index("by_shop_and_handle", ["shopId", "handle"])
		.index("by_shop_and_last_refreshed_at", ["shopId", "lastRefreshedAt"])
		.index("by_shop_and_shopify_product_id", ["shopId", "shopifyProductId"])
		.index("by_shop_and_source_updated_at", ["shopId", "sourceUpdatedAt"])
		.searchIndex("search_text", {
			filterFields: ["shopId"],
			searchField: "searchText",
		}),

	shopifyCatalogCollections: defineTable({
		description: v.optional(v.string()),
		domain: v.string(),
		handle: v.string(),
		lastRefreshedAt: v.number(),
		productCount: v.optional(v.number()),
		searchText: v.string(),
		shopId: v.id("shops"),
		shopifyCollectionId: v.string(),
		sourceUpdatedAt: v.number(),
		summary: v.string(),
		title: v.string(),
	})
		.index("by_shop_and_handle", ["shopId", "handle"])
		.index("by_shop_and_last_refreshed_at", ["shopId", "lastRefreshedAt"])
		.index("by_shop_and_shopify_collection_id", ["shopId", "shopifyCollectionId"])
		.index("by_shop_and_source_updated_at", ["shopId", "sourceUpdatedAt"])
		.searchIndex("search_text", {
			filterFields: ["shopId"],
			searchField: "searchText",
		}),

	shopifyMetricsCaches: defineTable({
		activeProductCount: v.number(),
		collectionCount: v.number(),
		createdAt: v.number(),
		domain: v.string(),
		lastOrderAt: v.optional(v.number()),
		lastOrderCurrencyCode: v.optional(v.string()),
		lastOrderFinancialStatus: v.optional(v.string()),
		lastOrderFulfillmentStatus: v.optional(v.string()),
		lastOrderValue: v.optional(v.number()),
		lastRefreshedAt: v.number(),
		locationCount: v.number(),
		productCount: v.number(),
		recentOrderCount: v.number(),
		recentOrderWindowDays: v.number(),
		shopId: v.id("shops"),
		updatedAt: v.number(),
	}).index("by_shop", ["shopId"]),

	syncJobs: defineTable({
		attemptCount: v.optional(v.number()),
		cacheKey: v.optional(v.string()),
		completedAt: v.optional(v.number()),
		domain: v.string(),
		error: v.optional(v.string()),
		jobKey: v.optional(v.string()),
		lastUpdatedAt: v.number(),
		payloadPreview: v.optional(v.string()),
		requestedAt: v.optional(v.number()),
		resultSummary: v.optional(v.string()),
		retryAt: v.optional(v.number()),
		retryCount: v.optional(v.number()),
		shopId: v.id("shops"),
		source: v.optional(v.string()),
		startedAt: v.optional(v.number()),
		status: v.string(),
		type: v.string(),
		triggeredByDeliveryId: v.optional(v.id("webhookDeliveries")),
	})
		.index("by_shop_status", ["shopId", "status"])
		.index("by_shop_and_last_updated_at", ["shopId", "lastUpdatedAt"])
		.index("by_shop_and_type_and_status", ["shopId", "type", "status"])
		.index("by_job_key", ["jobKey"]),

	workflowLogs: defineTable({
		createdAt: v.number(),
		detail: v.optional(v.string()),
		jobId: v.id("syncJobs"),
		level: v.string(),
		message: v.string(),
		shopId: v.id("shops"),
	})
		.index("by_job_and_created_at", ["jobId", "createdAt"])
		.index("by_shop_and_created_at", ["shopId", "createdAt"]),

	webhookDeliveries: defineTable({
		apiVersion: v.optional(v.string()),
		deliveryKey: v.optional(v.string()),
		domain: v.string(),
		error: v.optional(v.string()),
		eventId: v.optional(v.string()),
		payloadPreview: v.optional(v.string()),
		processedAt: v.optional(v.number()),
		receivedAt: v.number(),
		shopId: v.optional(v.id("shops")),
		status: v.string(),
		topic: v.string(),
		triggeredAt: v.optional(v.string()),
		webhookId: v.optional(v.string()),
	})
		.index("by_delivery_key", ["deliveryKey"])
		.index("by_shop_topic", ["shopId", "topic"])
		.index("by_shop_and_received_at", ["shopId", "receivedAt"])
		.index("by_status_received_at", ["status", "receivedAt"])
		.index("by_domain_received_at", ["domain", "receivedAt"])
		.index("by_event_id", ["eventId"])
		.index("by_webhook_id", ["webhookId"]),

	webhookPayloads: defineTable({
		createdAt: v.number(),
		deliveryId: v.id("webhookDeliveries"),
		payloadPreview: v.string(),
	}).index("by_delivery", ["deliveryId"]),

	storefrontAiEvents: defineTable({
		cardCount: v.number(),
		cartPlanItemCount: v.number(),
		clientFingerprint: v.optional(v.string()),
		createdAt: v.number(),
		outcome: v.union(
			v.literal("answer"),
			v.literal("refusal"),
			v.literal("rate_limited"),
			v.literal("disabled"),
		),
		pageTitle: v.optional(v.string()),
		promptCategory: v.string(),
		promptPreview: v.string(),
		refusalReason: v.optional(v.string()),
		sessionId: v.optional(v.string()),
		shopId: v.id("shops"),
		suggestedPromptCount: v.number(),
		toolNames: v.array(v.string()),
	})
		.index("by_shop_and_created_at", ["shopId", "createdAt"])
		.index("by_shop_and_outcome_and_created_at", ["shopId", "outcome", "createdAt"]),

	storefrontAiModerationFlags: defineTable({
		clientFingerprint: v.optional(v.string()),
		createdAt: v.number(),
		fingerprintKey: v.string(),
		lastPromptPreview: v.optional(v.string()),
		lastTriggeredAt: v.number(),
		reasonCounts: v.record(v.string(), v.number()),
		sessionId: v.optional(v.string()),
		shopId: v.id("shops"),
		totalCount: v.number(),
	})
		.index("by_shop_and_fingerprint_key", ["shopId", "fingerprintKey"])
		.index("by_shop_and_last_triggered_at", ["shopId", "lastTriggeredAt"]),

	storefrontAiSessions: defineTable({
		clientFingerprint: v.optional(v.string()),
		createdAt: v.number(),
		lastPromptAt: v.number(),
		lastPromptPreview: v.optional(v.string()),
		lastReply: v.optional(storefrontWidgetReplyValidator),
		lastReplyAt: v.optional(v.number()),
		lastReplyOrder: v.optional(v.number()),
		sessionId: v.string(),
		shopId: v.id("shops"),
		threadId: v.string(),
		updatedAt: v.number(),
	})
		.index("by_shop_and_session_id", ["shopId", "sessionId"])
		.index("by_shop_and_thread_id", ["shopId", "threadId"])
		.index("by_updated_at", ["updatedAt"]),

	storefrontAiRateLimits: defineTable({
		clientFingerprint: v.optional(v.string()),
		count: v.number(),
		key: v.string(),
		scope: v.union(v.literal("client"), v.literal("session")),
		sessionId: v.optional(v.string()),
		shopId: v.id("shops"),
		updatedAt: v.number(),
		windowEndsAt: v.number(),
		windowStartedAt: v.number(),
	})
		.index("by_shop_and_scope_and_key", ["shopId", "scope", "key"])
		.index("by_window_ends_at", ["windowEndsAt"]),

	merchantActionApprovals: defineTable({
		actorId: v.id("merchantActors"),
		conversationId: v.optional(v.id("merchantCopilotConversations")),
		createdAt: v.number(),
		decidedAt: v.optional(v.number()),
		errorMessage: v.optional(v.string()),
		plannedChangesJson: v.string(),
		requestPayload: v.optional(v.any()),
		requestedAt: v.number(),
		resultSummary: v.optional(v.string()),
		riskSummary: v.string(),
		shopDomain: v.string(),
		shopId: v.id("shops"),
		status: v.string(),
		summary: v.string(),
		targetId: v.optional(v.string()),
		targetLabel: v.string(),
		targetType: v.string(),
		tool: v.string(),
		updatedAt: v.number(),
	})
		.index("by_shop_and_requested_at", ["shopId", "requestedAt"])
		.index("by_shop_and_status_and_requested_at", ["shopId", "status", "requestedAt"])
		.index("by_conversation_and_requested_at", ["conversationId", "requestedAt"]),

	merchantCopilotConversations: defineTable({
		actorId: v.id("merchantActors"),
		createdAt: v.number(),
		lastAssistantSummary: v.optional(v.string()),
		lastPromptPreview: v.optional(v.string()),
		shopId: v.id("shops"),
		title: v.string(),
		updatedAt: v.number(),
	})
		.index("by_shop_and_actor_and_updated_at", ["shopId", "actorId", "updatedAt"])
		.index("by_shop_and_updated_at", ["shopId", "updatedAt"]),

	merchantCopilotMessages: defineTable({
		actorId: v.id("merchantActors"),
		approvalIds: v.optional(v.array(v.id("merchantActionApprovals"))),
		body: v.string(),
		citationsJson: v.optional(v.string()),
		conversationId: v.id("merchantCopilotConversations"),
		createdAt: v.number(),
		dashboardSpecJson: v.optional(v.string()),
		role: v.union(v.literal("assistant"), v.literal("system"), v.literal("user")),
		shopId: v.id("shops"),
		toolNames: v.array(v.string()),
	})
		.index("by_conversation_and_created_at", ["conversationId", "createdAt"])
		.index("by_shop_and_created_at", ["shopId", "createdAt"]),

	merchantDocuments: defineTable({
		byteLength: v.optional(v.number()),
		chunkCount: v.optional(v.number()),
		content: v.optional(v.string()),
		contentPreview: v.string(),
		contentTruncated: v.optional(v.boolean()),
		createdAt: v.number(),
		failureReason: v.optional(v.string()),
		fileName: v.optional(v.string()),
		lastProcessedAt: v.optional(v.number()),
		mimeType: v.optional(v.string()),
		parsedCharacterCount: v.optional(v.number()),
		processingQueuedAt: v.optional(v.number()),
		processingStartedAt: v.optional(v.number()),
		r2Key: v.optional(v.string()),
		searchText: v.string(),
		shopId: v.id("shops"),
		sourceType: v.string(),
		status: v.union(v.literal("failed"), v.literal("processing"), v.literal("ready")),
		summary: v.string(),
		title: v.string(),
		updatedAt: v.number(),
		uploadedByActorId: v.id("merchantActors"),
		visibility: v.union(v.literal("public"), v.literal("shop_private")),
	})
		.index("by_shop_and_updated_at", ["shopId", "updatedAt"])
		.index("by_shop_and_status_and_updated_at", ["shopId", "status", "updatedAt"])
		.index("by_shop_and_visibility_and_updated_at", ["shopId", "visibility", "updatedAt"])
		.searchIndex("search_text", {
			filterFields: ["shopId", "status", "visibility"],
			searchField: "searchText",
		}),

	merchantDocumentChunks: defineTable({
		chunkNumber: v.number(),
		charEnd: v.number(),
		charStart: v.number(),
		createdAt: v.number(),
		documentId: v.id("merchantDocuments"),
		embedding: v.array(v.number()),
		embeddingModel: v.string(),
		fileName: v.optional(v.string()),
		scopeKey: v.string(),
		searchText: v.string(),
		shopId: v.id("shops"),
		snippet: v.string(),
		text: v.string(),
		title: v.string(),
		updatedAt: v.number(),
		visibility: v.union(v.literal("public"), v.literal("shop_private")),
	})
		.index("by_document_and_chunk_number", ["documentId", "chunkNumber"])
		.index("by_shop_and_updated_at", ["shopId", "updatedAt"])
		.searchIndex("search_text", {
			filterFields: ["shopId", "visibility", "documentId"],
			searchField: "searchText",
		})
		.vectorIndex("by_embedding", {
			dimensions: 1536,
			filterFields: ["scopeKey"],
			vectorField: "embedding",
		}),

	widgetConfigs: defineTable({
		accentColor: v.string(),
		createdAt: v.number(),
		enabled: v.boolean(),
		greeting: v.string(),
		knowledgeSources: v.optional(v.array(v.string())),
		policyAnswers: v.optional(storefrontPolicyAnswersValidator),
		position: v.union(v.literal("bottom-right"), v.literal("bottom-left")),
		shopId: v.id("shops"),
		updatedAt: v.number(),
	}).index("by_shop", ["shopId"]),
});
