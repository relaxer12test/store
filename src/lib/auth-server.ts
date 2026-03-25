import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";
import { getRequiredConvexDeploymentUrl, getRequiredConvexHttpUrl } from "@/lib/env";

const betterAuthServer = convexBetterAuthReactStart({
	convexSiteUrl: getRequiredConvexHttpUrl(),
	convexUrl: getRequiredConvexDeploymentUrl(),
});

export const authHandler = betterAuthServer.handler;
export const fetchAuthAction = betterAuthServer.fetchAuthAction;
export const fetchAuthMutation = betterAuthServer.fetchAuthMutation;
export const fetchAuthQuery = betterAuthServer.fetchAuthQuery;
export const getBetterAuthToken = betterAuthServer.getToken;
