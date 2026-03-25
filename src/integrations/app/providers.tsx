import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConvexProvider } from "convex/react";

interface AppProvidersProps {
	children: React.ReactNode;
	convexQueryClient: ConvexQueryClient;
	queryClient: QueryClient;
}

export function AppProviders({ children, convexQueryClient, queryClient }: AppProvidersProps) {
	return (
		<ConvexProvider client={convexQueryClient.convexClient}>
			<QueryClientProvider client={queryClient}>
				{children}
				{import.meta.env.DEV ? <ReactQueryDevtools buttonPosition="bottom-left" /> : null}
			</QueryClientProvider>
		</ConvexProvider>
	);
}
