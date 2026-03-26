import { v } from "convex/values";
import type {
	InternalStorefrontAiSessionSummary,
	InternalStorefrontAiSessionsData,
	InternalStorefrontAiTranscriptData,
	InternalStorefrontAiTranscriptMessage,
} from "@/shared/contracts/internal-storefront-ai";
import { components } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { requireAdmin } from "./auth";

const MAX_SESSIONS = 40;
const MESSAGE_PAGE_SIZE = 100;
const MAX_TRANSCRIPT_MESSAGES = 500;

function formatTimestamp(value: number | undefined | null) {
	if (!value) {
		return null;
	}

	return new Date(value).toISOString();
}

function getReplyPreview(reply: Doc<"storefrontAiSessions">["lastReply"] | undefined) {
	const answer = reply?.answer?.trim();

	return answer ? answer.slice(0, 280) : null;
}

function getReplyTone(reply: Doc<"storefrontAiSessions">["lastReply"] | undefined) {
	return reply?.tone ?? null;
}

function getRefusalReason(reply: Doc<"storefrontAiSessions">["lastReply"] | undefined) {
	return reply?.refusalReason ?? null;
}

function toSessionSummary(
	session: Doc<"storefrontAiSessions">,
	shop: Doc<"shops"> | null,
): InternalStorefrontAiSessionSummary {
	return {
		clientFingerprint: session.clientFingerprint ?? null,
		createdAt: formatTimestamp(session.createdAt) ?? new Date(0).toISOString(),
		id: session._id,
		lastPromptAt: formatTimestamp(session.lastPromptAt) ?? new Date(0).toISOString(),
		lastPromptPreview: session.lastPromptPreview ?? null,
		lastRefusalReason: getRefusalReason(session.lastReply),
		lastReplyAt: formatTimestamp(session.lastReplyAt),
		lastReplyPreview: getReplyPreview(session.lastReply),
		lastReplyTone: getReplyTone(session.lastReply),
		sessionId: session.sessionId,
		shopDomain: shop?.domain ?? "unknown",
		shopId: session.shopId,
		shopName: shop?.name ?? "Unknown shop",
		threadId: session.threadId,
		updatedAt: formatTimestamp(session.updatedAt) ?? new Date(0).toISOString(),
	};
}

function getMessageRole(message: {
	message?: {
		role?: string;
	};
}): InternalStorefrontAiTranscriptMessage["role"] {
	const role = message.message?.role;

	switch (role) {
		case "assistant":
		case "system":
		case "tool":
		case "user":
			return role;
		default:
			return "assistant";
	}
}

function getMessageBody(message: {
	_status?: string;
	creationError?: string;
	error?: string;
	text?: string;
}) {
	const text = message.text?.trim();

	if (text) {
		return text;
	}

	const error = message.error?.trim() ?? message.creationError?.trim();

	if (error) {
		return error;
	}

	return "No text content was persisted for this message.";
}

function toTranscriptMessage(message: {
	_creationTime: number;
	_id: string;
	error?: string;
	message?: {
		role?: string;
	};
	model?: string;
	order: number;
	provider?: string;
	status: "failed" | "pending" | "success";
	stepOrder: number;
	text?: string;
}): InternalStorefrontAiTranscriptMessage {
	return {
		body: getMessageBody(message),
		createdAt: new Date(message._creationTime).toISOString(),
		error: message.error ?? null,
		id: message._id,
		model: message.model ?? null,
		order: message.order,
		provider: message.provider ?? null,
		role: getMessageRole(message),
		status: message.status,
		stepOrder: message.stepOrder,
	};
}

async function readShopMap(ctx: QueryCtx, sessions: Doc<"storefrontAiSessions">[]) {
	const uniqueShopIds = Array.from(new Set(sessions.map((session) => session.shopId)));
	const shops = await Promise.all(uniqueShopIds.map((shopId) => ctx.db.get(shopId)));

	return new Map(uniqueShopIds.map((shopId, index) => [shopId, shops[index] ?? null]));
}

async function readThread(
	ctx: QueryCtx,
	threadId: string,
): Promise<{
	error: string | null;
	thread: {
		status: "active" | "archived";
		title?: string;
		userId?: string;
	} | null;
}> {
	try {
		const thread = await ctx.runQuery(components.agent.threads.getThread, {
			threadId,
		});

		return {
			error: null,
			thread: thread
				? {
						status: thread.status,
						title: thread.title,
						userId: thread.userId,
					}
				: null,
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Thread metadata is unavailable.",
			thread: null,
		};
	}
}

async function readTranscriptMessages(
	ctx: QueryCtx,
	threadId: string,
): Promise<{
	error: string | null;
	messages: InternalStorefrontAiTranscriptMessage[];
	truncated: boolean;
}> {
	type TranscriptMessagePage = {
		continueCursor: string;
		isDone: boolean;
		page: Array<{
			_creationTime: number;
			_id: string;
			error?: string;
			message?: {
				role?: string;
			};
			model?: string;
			order: number;
			provider?: string;
			status: "failed" | "pending" | "success";
			stepOrder: number;
			text?: string;
		}>;
	};

	const messages: InternalStorefrontAiTranscriptMessage[] = [];
	let cursor: string | null = null;

	try {
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

			messages.push(...result.page.map(toTranscriptMessage));

			if (result.isDone) {
				return {
					error: null,
					messages,
					truncated: false,
				};
			}

			cursor = result.continueCursor;

			if (!cursor) {
				break;
			}
		}

		return {
			error: null,
			messages,
			truncated: true,
		};
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : "Transcript messages are unavailable.",
			messages: [],
			truncated: false,
		};
	}
}

export const sessions = query({
	args: {},
	handler: async (ctx): Promise<InternalStorefrontAiSessionsData> => {
		await requireAdmin(ctx);

		const sessionRows = await ctx.db
			.query("storefrontAiSessions")
			.withIndex("by_updated_at")
			.order("desc")
			.take(MAX_SESSIONS);
		const shopMap = await readShopMap(ctx, sessionRows);

		return {
			generatedAt: new Date().toISOString(),
			sessions: sessionRows.map((session) =>
				toSessionSummary(session, shopMap.get(session.shopId) ?? null),
			),
		};
	},
});

export const sessionTranscript = query({
	args: {
		sessionDocumentId: v.id("storefrontAiSessions"),
	},
	handler: async (ctx, args): Promise<InternalStorefrontAiTranscriptData | null> => {
		await requireAdmin(ctx);

		const session = await ctx.db.get(args.sessionDocumentId);

		if (!session) {
			return null;
		}

		const shop = await ctx.db.get(session.shopId);
		const threadResult = await readThread(ctx, session.threadId);
		const transcriptResult = threadResult.thread
			? await readTranscriptMessages(ctx, session.threadId)
			: {
					error: threadResult.error ?? "The backing agent thread could not be found.",
					messages: [],
					truncated: false,
				};

		return {
			clientFingerprint: session.clientFingerprint ?? null,
			createdAt: formatTimestamp(session.createdAt) ?? new Date(0).toISOString(),
			lastCardCount: session.lastReply?.cards.length ?? 0,
			lastCartPlanItemCount: session.lastReply?.cartPlan?.items.length ?? 0,
			lastPromptAt: formatTimestamp(session.lastPromptAt) ?? new Date(0).toISOString(),
			lastPromptPreview: session.lastPromptPreview ?? null,
			lastRefusalReason: getRefusalReason(session.lastReply),
			lastReplyAt: formatTimestamp(session.lastReplyAt),
			lastReplyOrder: session.lastReplyOrder ?? null,
			lastReplyPreview: getReplyPreview(session.lastReply),
			lastReplyTone: getReplyTone(session.lastReply),
			messages: transcriptResult.messages,
			messagesTruncated: transcriptResult.truncated,
			sessionDocumentId: session._id,
			sessionId: session.sessionId,
			shopDomain: shop?.domain ?? "unknown",
			shopId: session.shopId,
			shopName: shop?.name ?? "Unknown shop",
			threadError: transcriptResult.error,
			threadId: session.threadId,
			threadStatus: threadResult.thread?.status ?? "missing",
			threadTitle: threadResult.thread?.title ?? null,
			threadUserId: threadResult.thread?.userId ?? null,
			updatedAt: formatTimestamp(session.updatedAt) ?? new Date(0).toISOString(),
		};
	},
});
