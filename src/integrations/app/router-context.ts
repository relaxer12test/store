import { ConvexQueryClient } from "@convex-dev/react-query";
import { QueryClient } from "@tanstack/react-query";
import { createEmbeddedAppManager, type EmbeddedAppManager } from "@/integrations/app/embedded";
import { authClient } from "@/lib/auth-client";
import { getCurrentViewerServer } from "@/lib/auth-functions";
import { currentViewerQuery } from "@/lib/auth-queries";
import { getRequiredConvexDeploymentUrl } from "@/lib/env";
import { hasAdminViewer, hasMerchantViewer, type AppViewerContext } from "@/shared/contracts/auth";

const SHOPIFY_MERCHANT_AUTH_LOG_PREFIX = "[shopify-merchant-auth]";

export interface AppRouterContext {
	auth: {
		ensureEmbeddedViewer: () => Promise<AppViewerContext | null>;
	};
	convexQueryClient: ConvexQueryClient;
	embeddedApp: EmbeddedAppManager;
	preload: {
		ensureQueryData: QueryClient["ensureQueryData"];
	};
	queryClient: QueryClient;
}

async function readBootstrapError(response: Response) {
	const payload = await response
		.clone()
		.json()
		.catch(() => null);

	if (payload && typeof payload.error === "string") {
		return payload.error;
	}

	return `Bootstrap failed with status ${response.status}.`;
}

function createManagedAppRouterContext(): AppRouterContext {
	const convexQueryClient = new ConvexQueryClient(getRequiredConvexDeploymentUrl(), {
		expectAuth: true,
	});
	const embeddedApp = createEmbeddedAppManager();
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: {
				gcTime: 1000 * 60 * 5,
				queryKeyHashFn: convexQueryClient.hashFn(),
				queryFn: convexQueryClient.queryFn(),
				refetchOnWindowFocus: false,
			},
		},
	});

	convexQueryClient.connect(queryClient);

	const syncCurrentViewer = async () => {
		const viewer = await getCurrentViewerServer();
		queryClient.setQueryData(currentViewerQuery.queryKey, viewer);

		return viewer;
	};

	const ensureEmbeddedViewer = async () => {
		const cachedViewer =
			(queryClient.getQueryData(currentViewerQuery.queryKey) as
				| AppViewerContext
				| null
				| undefined) ?? null;

		if (
			hasMerchantViewer(cachedViewer) ||
			hasAdminViewer(cachedViewer) ||
			typeof window === "undefined"
		) {
			return cachedViewer;
		}

		const embeddedState = await embeddedApp.ensureReady();

		if (!embeddedState.isEmbedded) {
			return cachedViewer;
		}

		const sessionToken = embeddedState.sessionToken ?? (await embeddedApp.getSessionToken());

		if (!sessionToken) {
			return cachedViewer;
		}

		const response = await fetch(`/api/shopify/bootstrap${window.location.search}`, {
			credentials: "same-origin",
			headers: {
				Authorization: `Bearer ${sessionToken}`,
			},
			method: "POST",
		});

		if (!response.ok) {
			console.error(`${SHOPIFY_MERCHANT_AUTH_LOG_PREFIX} bootstrap_failed`, {
				error: await readBootstrapError(response),
				shop: embeddedState.shop,
				status: response.status,
			});

			return cachedViewer;
		}

		await authClient.getSession();

		return await syncCurrentViewer();
	};

	return {
		auth: {
			ensureEmbeddedViewer,
		},
		convexQueryClient,
		embeddedApp,
		preload: {
			ensureQueryData: queryClient.ensureQueryData.bind(queryClient),
		},
		queryClient,
	};
}

let browserContext: AppRouterContext | undefined;

export function getAppRouterContext(): AppRouterContext {
	if (typeof window === "undefined") {
		return createManagedAppRouterContext();
	}

	browserContext ??= createManagedAppRouterContext();

	return browserContext;
}
