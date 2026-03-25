import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConvexProvider } from "convex/react";
import { EmbeddedAppProvider, type EmbeddedAppManager } from "@/integrations/app/embedded";

interface AppProvidersProps {
	children: React.ReactNode;
	convexQueryClient: ConvexQueryClient;
	embeddedApp: EmbeddedAppManager;
	queryClient: QueryClient;
}

export function AppProviders({
	children,
	convexQueryClient,
	embeddedApp,
	queryClient,
}: AppProvidersProps) {
	return (
		<ConvexProvider client={convexQueryClient.convexClient}>
			<QueryClientProvider client={queryClient}>
				<EmbeddedAppProvider manager={embeddedApp}>{children}</EmbeddedAppProvider>
				{import.meta.env.DEV ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
			</QueryClientProvider>
		</ConvexProvider>
	);
}
