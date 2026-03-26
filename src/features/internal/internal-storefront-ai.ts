import { convexQuery } from "@convex-dev/react-query";
import type { Id } from "@convex/_generated/dataModel";
import { api } from "@/lib/convex-api";

export const internalStorefrontAiSessionsQuery = convexQuery(api.internalStorefrontAi.sessions, {});

export function getInternalStorefrontAiTranscriptQuery(
	sessionDocumentId: Id<"storefrontAiSessions"> | "skip",
) {
	return convexQuery(
		api.internalStorefrontAi.sessionTranscript,
		sessionDocumentId === "skip" ? "skip" : { sessionDocumentId },
	);
}
