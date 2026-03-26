import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
import { getRequiredConvexDeploymentUrl, getRequiredConvexHttpUrl } from "@/lib/env";

export const betterAuthServer = convexBetterAuthReactStart({
	convexSiteUrl: getRequiredConvexHttpUrl(),
	convexUrl: getRequiredConvexDeploymentUrl(),
});

export const authHandler = betterAuthServer.handler;
