import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConvexProvider } from "convex/react";
import { useEffect } from "react";
import { SessionProvider, type SessionManager } from "@/features/auth/session/client";
import { EmbeddedAppProvider, type EmbeddedAppManager } from "@/integrations/app/embedded";
import type { AppRouterContext } from "@/integrations/app/router-context";

interface AppProvidersProps {
	children: React.ReactNode;
	convexQueryClient: ConvexQueryClient;
	embeddedApp: EmbeddedAppManager;
	enableEmbeddedSessionBootstrap: AppRouterContext["sessionApi"]["enableEmbeddedSessionBootstrap"];
	ensureEmbeddedSession: AppRouterContext["sessionApi"]["ensureEmbeddedSession"];
	queryClient: QueryClient;
	sessionManager: SessionManager;
}

export function AppProviders({
	children,
	convexQueryClient,
	embeddedApp,
	enableEmbeddedSessionBootstrap,
	ensureEmbeddedSession,
	queryClient,
	sessionManager,
}: AppProvidersProps) {
	useEffect(() => {
		enableEmbeddedSessionBootstrap();
		void ensureEmbeddedSession();
	}, [enableEmbeddedSessionBootstrap, ensureEmbeddedSession]);

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
