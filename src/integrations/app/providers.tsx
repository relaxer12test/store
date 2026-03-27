import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { EmbeddedAppProvider, type EmbeddedAppManager } from "@/integrations/app/embedded";
import { authClient } from "@/lib/auth-client";

interface AppProvidersProps {
	children: React.ReactNode;
	convexQueryClient: ConvexQueryClient;
	embeddedApp: EmbeddedAppManager;
	initialToken?: string | null;
	queryClient: QueryClient;
}

export function AppProviders({
	children,
	convexQueryClient,
	embeddedApp,
	initialToken,
	queryClient,
}: AppProvidersProps) {
	return (
		<QueryClientProvider client={queryClient}>
			<ConvexBetterAuthProvider
				authClient={authClient}
				client={convexQueryClient.convexClient}
				initialToken={initialToken}
			>
				<EmbeddedAppProvider manager={embeddedApp}>{children}</EmbeddedAppProvider>
			</ConvexBetterAuthProvider>
		</QueryClientProvider>
	);
}
