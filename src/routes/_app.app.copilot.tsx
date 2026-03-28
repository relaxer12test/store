import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { MerchantCopilotPage } from "@/features/app-shell/components/merchant-copilot-page";
import {
	merchantCopilotSessionsQuery,
	useMerchantCopilotState,
	useMerchantCopilotSessions,
} from "@/features/app-shell/merchant-workspace";

export const Route = createFileRoute("/_app/app/copilot")({
	validateSearch: (search: Record<string, unknown>) => ({
		conversation: typeof search.conversation === "string" ? search.conversation : undefined,
	}),
	loader: async ({ context }) => {
		await context.preload.ensureQueryData(merchantCopilotSessionsQuery);
	},
	component: MerchantCopilotRoute,
});

function MerchantCopilotRoute() {
	const navigate = useNavigate({
		from: Route.fullPath,
	});
	const search = Route.useSearch();
	const { data: sessionData } = useMerchantCopilotSessions();
	const activeConversationId = sessionData.sessions.find(
		(session) => session.conversationId === search.conversation,
	)?.conversationId as Id<"merchantCopilotConversations"> | undefined;
	const { data } = useMerchantCopilotState(activeConversationId);

	useEffect(() => {
		if (!search.conversation) {
			return;
		}

		if (activeConversationId) {
			return;
		}

		void navigate({
			search: (current) => ({
				...current,
				conversation: undefined,
			}),
			replace: true,
		});
	}, [activeConversationId, navigate, search.conversation]);

	return (
		<MerchantCopilotPage
			activeConversationId={activeConversationId ?? null}
			conversation={data}
			sessions={sessionData.sessions}
		/>
	);
}
