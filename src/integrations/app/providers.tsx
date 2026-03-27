import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConvexProvider } from "convex/react";
import { EmbeddedAppProvider, type EmbeddedAppManager } from "@/integrations/app/embedded";
import { SessionProvider, type SessionManager } from "@/lib/auth-client";

interface AppProvidersProps {
	children: React.ReactNode;
	convexQueryClient: ConvexQueryClient;
	embeddedApp: EmbeddedAppManager;
	queryClient: QueryClient;
	sessionManager: SessionManager;
}

export function AppProviders({
	children,
	convexQueryClient,
	embeddedApp,
	queryClient,
	sessionManager,
}: AppProvidersProps) {
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
