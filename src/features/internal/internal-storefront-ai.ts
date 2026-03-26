import { convexQuery } from "@convex-dev/react-query";
import { api } from "@/lib/convex-api";

export const internalStorefrontAiSessionsQuery = convexQuery(api.internalStorefrontAi.sessions, {});

export function getInternalStorefrontAiTranscriptQuery(sessionDocumentId: string) {
	return convexQuery(api.internalStorefrontAi.sessionTranscript, {
		sessionDocumentId,
	});
}
