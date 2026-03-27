import { v } from "convex/values";
import type {
	StorefrontWidgetConfig,
	StorefrontWidgetSessionDetail,
	StorefrontWidgetSessionSummary,
	StorefrontWidgetTranscriptMessage,
} from "../src/shared/contracts/storefront-widget";
import { components, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { authComponent } from "./auth";
import { getStorefrontConfigFallback } from "./storefrontWidgetRuntime";

const MAX_VIEWER_SESSIONS = 12;
const MESSAGE_PAGE_SIZE = 80;
const MAX_TRANSCRIPT_MESSAGES = 160;

type ViewerRecord = {
	id: string;
};

type TranscriptMessagePage = {
	continueCursor: string;
	isDone: boolean;
	page: Array<{
		_creationTime: number;
		_id: string;
		message?: {
			role?: string;
		};
		text?: string;
	}>;
};

function normalizeShopDomain(shopDomain: string) {
	return shopDomain.trim().toLowerCase();
}

function formatTimestamp(value: number | undefined | null) {
	if (!value) {
		return null;
	}

	return new Date(value).toISOString();
}

function toSessionTitle(session: Doc<"storefrontAiSessions">) {
	const prompt = session.lastPromptPreview?.trim();
	const answer = session.lastReply?.answer?.trim();

	return (prompt || answer || "New chat").slice(0, 80);
}

function toSessionReplyPreview(session: Doc<"storefrontAiSessions">) {
	const answer = session.lastReply?.answer?.trim();

	return answer ? answer.slice(0, 180) : null;
}

function getTranscriptRole(message: {
	message?: {
		role?: string;
	};
}): StorefrontWidgetTranscriptMessage["role"] {
	switch (message.message?.role) {
		case "assistant":
		case "system":
		case "user":
			return message.message.role;
		default:
			return "assistant";
	}
}

async function getViewer(ctx: QueryCtx): Promise<ViewerRecord | null> {
	const user = (await authComponent.safeGetAuthUser(ctx)) as ViewerRecord | undefined;

	return user ?? null;
}

async function getConnectedShopByDomain(ctx: QueryCtx, shopDomain: string) {
	const shop = await ctx.db
		.query("shops")
		.withIndex("by_domain", (query) => query.eq("domain", normalizeShopDomain(shopDomain)))
		.unique();

	return shop?.installStatus === "connected" ? shop : null;
}

async function readTranscriptMessages(ctx: QueryCtx, threadId: string) {
	const messages: StorefrontWidgetTranscriptMessage[] = [];
	let cursor: string | null = null;

	while (messages.length < MAX_TRANSCRIPT_MESSAGES) {
		const remaining = MAX_TRANSCRIPT_MESSAGES - messages.length;
		const pageSize = Math.min(MESSAGE_PAGE_SIZE, remaining);
		const result: TranscriptMessagePage = await ctx.runQuery(
			components.agent.messages.listMessagesByThreadId,
			{
				excludeToolMessages: true,
				order: "asc" as const,
				paginationOpts: {
					cursor,
					numItems: pageSize,
				},
				threadId,
			},
		);

		messages.push(
			...result.page
				.map((message) => {
					const body = message.text?.trim();

					if (!body) {
						return null;
					}

					return {
						body,
						createdAt: new Date(message._creationTime).toISOString(),
						id: message._id,
						role: getTranscriptRole(message),
					} satisfies StorefrontWidgetTranscriptMessage;
				})
				.filter(
					(message): message is StorefrontWidgetTranscriptMessage => message !== null,
				),
		);

		if (result.isDone) {
			break;
		}

		cursor = result.continueCursor;

		if (!cursor) {
			break;
		}
	}

	return messages;
}

export const getConfig = query({
	args: {
		shopDomain: v.string(),
	},
	handler: async (ctx, args): Promise<StorefrontWidgetConfig> => {
		const normalizedShopDomain = normalizeShopDomain(args.shopDomain);
		const context: { config: StorefrontWidgetConfig; shopId: Id<"shops"> | null } =
			await ctx.runQuery(internal.storefrontConcierge.getContext, {
				shopDomain: normalizedShopDomain,
			});

		return context.config ?? getStorefrontConfigFallback(normalizedShopDomain);
	},
});

export const listViewerSessions = query({
	args: {
		shopDomain: v.string(),
	},
	handler: async (ctx, args): Promise<StorefrontWidgetSessionSummary[]> => {
		const [viewer, shop] = await Promise.all([
			getViewer(ctx),
			getConnectedShopByDomain(ctx, args.shopDomain),
		]);

		if (!viewer || !shop) {
			return [];
		}

		const sessions = await ctx.db
			.query("storefrontAiSessions")
			.withIndex("by_shop_and_viewer_user_id_and_updated_at", (query) =>
				query.eq("shopId", shop._id).eq("viewerUserId", viewer.id),
			)
			.order("desc")
			.take(MAX_VIEWER_SESSIONS);

		return sessions.map((session) => ({
			createdAt: formatTimestamp(session.createdAt) ?? new Date(0).toISOString(),
			lastReplyPreview: toSessionReplyPreview(session),
			lastReplyTone: session.lastReply?.tone ?? null,
			lastUpdatedAt: formatTimestamp(session.updatedAt) ?? new Date(0).toISOString(),
			sessionId: session.sessionId,
			title: toSessionTitle(session),
		}));
	},
});

export const getViewerSessionDetail = query({
	args: {
		sessionId: v.string(),
		shopDomain: v.string(),
	},
	handler: async (ctx, args): Promise<StorefrontWidgetSessionDetail | null> => {
		const [viewer, shop] = await Promise.all([
			getViewer(ctx),
			getConnectedShopByDomain(ctx, args.shopDomain),
		]);

		if (!viewer || !shop) {
			return null;
		}

		const session = await ctx.db
			.query("storefrontAiSessions")
			.withIndex("by_shop_and_session_id", (query) =>
				query.eq("shopId", shop._id).eq("sessionId", args.sessionId),
			)
			.unique();

		if (!session || session.viewerUserId !== viewer.id) {
			return null;
		}

		return {
			messages: await readTranscriptMessages(ctx, session.threadId),
			sessionId: session.sessionId,
			title: toSessionTitle(session),
		};
	},
});
