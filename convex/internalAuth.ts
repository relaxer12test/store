import type { UserIdentity } from "convex/server";

type InternalAuthCtx = {
	auth: {
		getUserIdentity: () => Promise<UserIdentity | null>;
	};
};

function getIdentityRoles(identity: UserIdentity | null) {
	const roles = identity?.roles;

	if (!Array.isArray(roles)) {
		return [];
	}

	return roles.filter((role): role is string => typeof role === "string");
}

export function hasInternalStaffRole(identity: UserIdentity | null) {
	return (
		getIdentityRoles(identity).includes("internal_staff") ||
		identity?.isInternalStaff === true ||
		(typeof identity?.userId === "string" && identity.userId.startsWith("internal:"))
	);
}

export async function requireInternalStaff(ctx: InternalAuthCtx) {
	const identity = await ctx.auth.getUserIdentity();

	if (!hasInternalStaffRole(identity)) {
		throw new Error("Internal diagnostics require an authenticated staff session.");
	}

	return identity;
}
