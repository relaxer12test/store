import { createFileRoute } from "@tanstack/react-router";
import { InternalAiChatPage } from "@/features/internal/components/internal-ai-chat-page";
import { internalStorefrontAiSessionsQuery } from "@/features/internal/internal-storefront-ai";

export const Route = createFileRoute("/_chrome/internal/ai-chats")({
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(internalStorefrontAiSessionsQuery);
	},
	component: InternalAiChatsRoute,
});

function InternalAiChatsRoute() {
	return <InternalAiChatPage />;
}
