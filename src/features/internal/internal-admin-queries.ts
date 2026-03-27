import { convexQuery } from "@convex-dev/react-query";
import type { Id } from "@convex/_generated/dataModel";
import type {
	InternalAiSessionDetailSearch,
	InternalAiSessionSearch,
	InternalAuditSearch,
	InternalCacheSearch,
	InternalShopsSearch,
	InternalUsersSearch,
	InternalWebhookSearch,
	InternalWorkflowSearch,
} from "@/features/internal/internal-admin-route-state";
import { api } from "@/lib/convex-api";

function toPaginationArgs(search: { cursor?: string; limit: number }) {
	return {
		paginationOpts: {
			cursor: search.cursor ?? null,
			numItems: search.limit,
		},
	};
}

export const internalOverviewQuery = convexQuery(api.systemStatus.snapshot, {});

export function getInternalShopsQuery(search: InternalShopsSearch) {
	return convexQuery(api.internalAdmin.listShops, {
		...toPaginationArgs(search),
		dir: search.dir,
		q: search.q,
		sort: search.sort,
		status: search.status,
	});
}

export function getInternalShopDetailQuery(shopId: string) {
	return convexQuery(api.internalAdmin.getShopDetail, {
		shopId: shopId as Id<"shops">,
	});
}

export function getInternalCacheStatesQuery(search: InternalCacheSearch) {
	return convexQuery(api.internalAdmin.listCacheStates, {
		...toPaginationArgs(search),
		dir: search.dir,
		q: search.q,
		sort: search.sort,
		status: search.status,
	});
}

export function getInternalCacheStateDetailQuery(cacheStateId: string) {
	return convexQuery(api.internalAdmin.getCacheStateDetail, {
		cacheStateId: cacheStateId as Id<"shopifyCacheStates">,
	});
}

export function getInternalWorkflowsQuery(search: InternalWorkflowSearch) {
	return convexQuery(api.internalAdmin.listWorkflows, {
		...toPaginationArgs(search),
		dir: search.dir,
		q: search.q,
		sort: search.sort,
		status: search.status,
	});
}

export function getInternalWorkflowDetailQuery(jobId: string) {
	return convexQuery(api.internalAdmin.getWorkflowDetail, {
		jobId: jobId as Id<"syncJobs">,
	});
}

export function getInternalWebhookDeliveriesQuery(search: InternalWebhookSearch) {
	return convexQuery(api.internalAdmin.listWebhookDeliveries, {
		...toPaginationArgs(search),
		dir: search.dir,
		q: search.q,
		sort: search.sort,
		status: search.status,
	});
}

export function getInternalWebhookDetailQuery(deliveryId: string) {
	return convexQuery(api.internalAdmin.getWebhookDetail, {
		deliveryId: deliveryId as Id<"webhookDeliveries">,
	});
}

export function getInternalAuditsQuery(search: InternalAuditSearch) {
	return convexQuery(api.internalAdmin.listAudits, {
		...toPaginationArgs(search),
		dir: search.dir,
		q: search.q,
		sort: search.sort,
	});
}

export function getInternalAuditDetailQuery(auditId: string) {
	return convexQuery(api.internalAdmin.getAuditDetail, {
		auditId: auditId as Id<"auditLogs">,
	});
}

export function getInternalAiSessionsQuery(search: InternalAiSessionSearch) {
	return convexQuery(api.internalAdmin.listAiSessions, {
		...toPaginationArgs(search),
		dir: search.dir,
		q: search.q,
		sort: search.sort,
	});
}

export function getInternalAiSessionDetailQuery(sessionDocumentId: string) {
	return convexQuery(api.internalAdmin.getAiSessionDetail, {
		sessionDocumentId: sessionDocumentId as Id<"storefrontAiSessions">,
	});
}

export function getInternalAiTranscriptPageQuery(
	search: InternalAiSessionDetailSearch,
	sessionDocumentId: string,
) {
	return convexQuery(api.internalAdmin.getAiSessionTranscriptPage, {
		paginationOpts: {
			cursor: search.transcriptCursor ?? null,
			numItems: search.transcriptLimit,
		},
		sessionDocumentId: sessionDocumentId as Id<"storefrontAiSessions">,
	});
}

export function getInternalUsersQuery(search: InternalUsersSearch) {
	return convexQuery(api.internalAdmin.listUsers, {
		...toPaginationArgs(search),
		dir: search.dir,
		q: search.q,
		role: search.role,
		sort: search.sort,
	});
}

export function getInternalUserDetailQuery(userId: string) {
	return convexQuery(api.internalAdmin.getUserDetail, {
		userId,
	});
}
