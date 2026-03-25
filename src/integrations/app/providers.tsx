import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConvexProvider } from "convex/react";
import { useEffect } from "react";
import { SessionProvider, type SessionManager } from "@/features/auth/session/client";
import { EmbeddedAppProvider, type EmbeddedAppManager } from "@/integrations/app/embedded";
import type { AppRouterContext } from "@/integrations/app/router-context";
import type { SessionEnvelope } from "@/shared/contracts/session";

interface AppProvidersProps {
	children: React.ReactNode;
	convexQueryClient: ConvexQueryClient;
	embeddedApp: EmbeddedAppManager;
	queryClient: QueryClient;
	request: AppRouterContext["request"];
	sessionManager: SessionManager;
	setSession: (session: SessionEnvelope) => void;
}

export function AppProviders({
	children,
	convexQueryClient,
	embeddedApp,
	queryClient,
	request,
	sessionManager,
	setSession,
}: AppProvidersProps) {
	useEffect(() => {
		let cancelled = false;

		async function bootstrapEmbeddedSession() {
			const embeddedState = await embeddedApp.ensureReady();

			if (!embeddedState.isEmbedded || !embeddedState.sessionToken) {
				return;
			}

			try {
				const response = await request.fetch("/api/shopify/bootstrap", {
					method: "POST",
					headers: {
						Accept: "application/json",
					},
				});

				if (!response.ok) {
					throw new Error(`Embedded bootstrap failed with status ${response.status}.`);
				}

				const session = (await response.json()) as SessionEnvelope;

				if (!cancelled) {
					setSession(session);
				}
			} catch {
				if (!cancelled) {
					setSession({
						authMode: "embedded",
						state: "offline",
						viewer: null,
						activeShop: null,
						roles: [],
						convexToken: null,
					});
				}
			}
		}

		void bootstrapEmbeddedSession();

		return () => {
			cancelled = true;
		};
	}, [convexQueryClient, embeddedApp, request, setSession]);

	return (
		<ConvexProvider client={convexQueryClient.convexClient}>
			<QueryClientProvider client={queryClient}>
				<SessionProvider manager={sessionManager}>
					<EmbeddedAppProvider manager={embeddedApp}>{children}</EmbeddedAppProvider>
				</SessionProvider>
				{import.meta.env.DEV ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
			</QueryClientProvider>
		</ConvexProvider>
	);
}
