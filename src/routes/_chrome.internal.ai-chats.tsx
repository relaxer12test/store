import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { InternalAiChatPage } from "@/features/internal/components/internal-ai-chat-page";
import { internalStorefrontAiSessionsQuery } from "@/features/internal/internal-storefront-ai";

export const Route = createFileRoute("/_chrome/internal/ai-chats")({
	validateSearch: (search: Record<string, unknown>) => ({
		q: typeof search.q === "string" ? search.q : undefined,
		sessionId: typeof search.sessionId === "string" ? search.sessionId : undefined,
	}),
	component: InternalAiChatsRoute,
});

function InternalAiChatsRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const search = Route.useSearch();

	return (
		<InternalAiChatPage
			searchQuery={search.q ?? ""}
			selectedSessionId={search.sessionId ?? null}
			onSearchChange={(q) => {
				void navigate({
					search: (current) => ({
						...current,
						q: q || undefined,
					}),
				});
			}}
			onSessionChange={(sessionId) => {
				void navigate({
					search: (current) => ({
						...current,
						sessionId,
					}),
				});
			}}
		/>
	);
}
