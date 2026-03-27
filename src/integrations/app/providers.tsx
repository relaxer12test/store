import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import {
	EmbeddedAppProvider,
	type EmbeddedAppManager,
	useEmbeddedAppBootstrap,
} from "@/integrations/app/embedded";
import { authClient, useAppAuth } from "@/lib/auth-client";
import { hasMerchantViewer } from "@/shared/contracts/auth";

interface AppProvidersProps {
	children: React.ReactNode;
	convexQueryClient: ConvexQueryClient;
	embeddedApp: EmbeddedAppManager;
	initialToken?: string | null;
	queryClient: QueryClient;
}

function EmbeddedMerchantBootstrap() {
	const auth = useAppAuth();
	const embeddedApp = useEmbeddedAppBootstrap();
	const router = useRouter();

	useEffect(() => {
		if (auth.isMerchant || !embeddedApp.isEmbedded) {
			return;
		}

		let cancelled = false;

		void router.options.context.auth.ensureEmbeddedViewer().then((viewer) => {
			if (!cancelled && hasMerchantViewer(viewer)) {
				void router.invalidate();
			}
		});

		return () => {
			cancelled = true;
		};
	}, [auth.isMerchant, embeddedApp.isEmbedded, router]);

	return null;
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
				<EmbeddedAppProvider manager={embeddedApp}>
					<EmbeddedMerchantBootstrap />
					{children}
				</EmbeddedAppProvider>
			</ConvexBetterAuthProvider>
		</QueryClientProvider>
	);
}
