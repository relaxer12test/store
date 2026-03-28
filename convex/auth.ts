import { createClient } from "@convex-dev/better-auth";
import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";
import { convex as betterAuthConvexPlugin } from "@convex-dev/better-auth/plugins";
import { components, internal } from "@convex/_generated/api";
import type { DataModel, Doc, Id } from "@convex/_generated/dataModel";
import {
	internalQuery,
	query,
	type ActionCtx,
	type MutationCtx,
	type QueryCtx,
} from "@convex/_generated/server";
import authSchema from "@convex/betterAuth/schema";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { admin } from "better-auth/plugins/admin";
import { anonymous } from "better-auth/plugins/anonymous";
import { getOrgAdapter, organization } from "better-auth/plugins/organization";
import type { UserIdentity } from "convex/server";
import { v } from "convex/values";
import { z } from "zod";
import { deriveViewerRoles, type AppViewerContext } from "@/shared/contracts/auth";
import {
	getShopOrganizationSlug,
	mapMerchantMemberRoleToViewerRole,
	merchantOrganizationSchema,
} from "@/shared/contracts/better-auth-tenancy";

type AuthCtx = ActionCtx | MutationCtx | QueryCtx;
type MerchantDbCtx = QueryCtx | MutationCtx;

const merchantOrganizationOptions = {
	allowUserToCreateOrganization: false,
	schema: merchantOrganizationSchema,
} as const;

export interface MerchantClaims {
	actorId: string;
	organizationId: string;
	roles: string[];
	shopDomain: string;
	shopId: Id<"shops">;
	shopifyUserId: string;
	userId: string;
}

export interface MerchantActorRecord {
	email: string | null;
	id: string;
	initials: string;
	lastAuthenticatedAt: number | null;
	name: string;
	organizationId: string;
	role: string;
	sessionId: string | null;
	shopDomain: string;
	shopId: Id<"shops">;
	shopifyUserId: string;
	userId: string;
}

export interface MerchantContext {
	actor: MerchantActorRecord;
	identity: UserIdentity | null;
	organization: BetterAuthOrganizationRecord;
	roles: string[];
	shop: Doc<"shops">;
	user: BetterAuthUserRecord;
}

interface MerchantLookup {
	actor: MerchantActorRecord;
	member: BetterAuthMemberRecord;
	organization: BetterAuthOrganizationRecord;
	shop: Doc<"shops">;
	user: BetterAuthUserRecord;
}

type MerchantContextSource =
	| "active_organization"
	| "admin_single_membership"
	| "admin_connected_shop";
type MerchantLookupResolution = {
	lookup: MerchantLookup;
	source: MerchantContextSource;
};

interface BetterAuthUserRecord {
	_id?: string;
	createdAt: Date;
	email: string;
	emailVerified?: boolean | null;
	id: string;
	image?: string | null;
	isAnonymous?: boolean | null;
	name: string;
	role?: string | null;
	updatedAt: Date;
	userId?: string | null;
}

interface BetterAuthSessionRecord {
	_id?: string;
	activeOrganizationId?: string | null;
	createdAt: Date;
	expiresAt: Date;
	id: string;
	impersonatedBy?: string | null;
	ipAddress?: string | null;
	token: string;
	updatedAt: Date;
	userAgent?: string | null;
	userId: string;
}

interface BetterAuthOrganizationRecord {
	_id?: string;
	createdAt: Date;
	id: string;
	logo?: string | null;
	name: string;
	planDisplayName?: string | null;
	shopDomain: string;
	shopId: string;
	shopifyShopId?: string | null;
	slug: string;
	updatedAt?: Date | null;
}

interface BetterAuthMemberRecord {
	_id?: string;
	createdAt: Date;
	id: string;
	initials?: string | null;
	lastAuthenticatedAt?: number | null;
	organizationId: string;
	role: string;
	sessionId?: string | null;
	shopifyUserId: string;
	userId: string;
}

interface ShopifyMerchantBridgeBody {
	email?: string;
	initials: string;
	lastAuthenticatedAt: number;
	name: string;
	planDisplayName?: string;
	sessionId?: string;
	shopDomain: string;
	shopId: string;
	shopName: string;
	shopifyShopId?: string;
	shopifyUserId: string;
}

const DEFAULT_AUTH_BASE_URL = "https://example.invalid";
const DEFAULT_AUTH_SECRET = "development-only-better-auth-secret-32";
const LOCAL_AUTH_ORIGINS = ["http://localhost:3000", "http://localhost:3001"] as const;
export const BETTER_AUTH_IP_HEADERS = [
	"cf-connecting-ip",
	"x-forwarded-for",
	"x-real-ip",
	"fly-client-ip",
] as const;
const SHOPIFY_MERCHANT_BRIDGE_PATH = "/sign-in/shopify-bridge";
const SHOPIFY_MERCHANT_BRIDGE_PROVIDER_ID = "shopify-merchant";
const SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER = "x-shopify-bridge-secret";
const SHOPIFY_MERCHANT_BOOTSTRAP_REQUEST_ID_HEADER = "x-shopify-bootstrap-request-id";
const SHOPIFY_MERCHANT_AUTH_LOG_PREFIX = "[shopify-merchant-auth]";
const INTERNAL_ADMIN_MERCHANT_ACTOR_PREFIX = "internal-admin:";
const INTERNAL_ADMIN_MERCHANT_ORGANIZATION_PREFIX = "internal-admin-org:";

function serializeMerchantBridgeError(error: unknown) {
	if (error instanceof APIError) {
		return {
			message: error.message,
			name: error.name,
			status: error.status,
		};
	}

	if (error instanceof Error) {
		return {
			message: error.message,
			name: error.name,
			stack: error.stack ?? null,
		};
	}

	return {
		message: String(error),
		name: "UnknownError",
		stack: null,
	};
}

function logShopifyMerchantBridgeFailure(details: Record<string, unknown>) {
	console.error(`${SHOPIFY_MERCHANT_AUTH_LOG_PREFIX} bridge_endpoint_failed`, details);
}

function sanitizeEmailPart(value: string) {
	const sanitized = value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 48);

	return sanitized.length > 0 ? sanitized : "merchant";
}

function buildMerchantBetterAuthEmail({
	shopDomain,
	shopifyUserId,
}: {
	shopDomain: string;
	shopifyUserId: string;
}) {
	return `${sanitizeEmailPart(shopDomain)}--${sanitizeEmailPart(shopifyUserId)}@shopify.local`;
}

function buildMerchantBridgeAccountId({
	shopDomain,
	shopifyUserId,
}: {
	shopDomain: string;
	shopifyUserId: string;
}) {
	return `${shopDomain.trim().toLowerCase()}:${shopifyUserId.trim()}`;
}

function normalizeBetterAuthEmail(email: string | null | undefined) {
	const normalized = email?.trim().toLowerCase();

	return normalized && normalized.length > 0 ? normalized : null;
}

function getInitials(name: string) {
	const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

	if (words.length === 0) {
		return "SA";
	}

	return words.map((word) => word.charAt(0).toUpperCase()).join("");
}

function getProcessEnv(name: string) {
	return (
		globalThis as typeof globalThis & {
			process?: {
				env?: Record<string, string | undefined>;
			};
		}
	).process?.env?.[name];
}

function getOptionalEnv(name: string) {
	return getProcessEnv(name)?.trim() || undefined;
}

function getAuthBaseUrl() {
	return getOptionalEnv("SHOPIFY_APP_URL") ?? DEFAULT_AUTH_BASE_URL;
}

export function getTrustedAuthOrigins() {
	const origins = new Set<string>([getAuthBaseUrl(), ...LOCAL_AUTH_ORIGINS]);
	return Array.from(origins);
}

export function buildPasswordResetLink(url: string, token: string) {
	const resetUrl = new URL(url);
	const callbackUrl = resetUrl.searchParams.get("callbackURL");

	if (!callbackUrl) {
		return url;
	}

	const directUrl = new URL(callbackUrl, getAuthBaseUrl());
	directUrl.searchParams.set("token", token);

	return directUrl.toString();
}

export function getAuthSecret() {
	return getOptionalEnv("BETTER_AUTH_SECRET") ?? DEFAULT_AUTH_SECRET;
}

function getMerchantBridgeRole({
	currentRole,
	existingUsers,
	userId,
}: {
	currentRole?: string | null;
	existingUsers: Array<{
		id: string;
	}>;
	userId: string;
}) {
	if (currentRole === "admin") {
		return "admin";
	}

	const otherUsers = existingUsers.filter((user) => user.id !== userId);

	return otherUsers.length === 0 ? "admin" : "user";
}

function toSessionUser(user: BetterAuthUserRecord) {
	return {
		...user,
		emailVerified: user.emailVerified ?? false,
	};
}

function getIdentityRoles(identity: UserIdentity | null) {
	const roles = identity?.roles;

	if (!Array.isArray(roles)) {
		return [];
	}

	return roles.filter((role): role is string => typeof role === "string");
}

function getIdentityRole(identity: UserIdentity | null) {
	return typeof identity?.role === "string" ? identity.role : null;
}

function getSessionId(identity: UserIdentity | null) {
	return typeof identity?.sessionId === "string" && identity.sessionId.length > 0
		? identity.sessionId
		: null;
}

function getActiveOrganizationId(identity: UserIdentity | null) {
	return typeof identity?.activeOrganizationId === "string" &&
		identity.activeOrganizationId.length > 0
		? identity.activeOrganizationId
		: null;
}

function toOptionalNumber(value: Date | number | null | undefined) {
	if (typeof value === "number") {
		return value;
	}

	if (value instanceof Date) {
		return value.getTime();
	}

	return null;
}

function toOptionalString(value: unknown) {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function getAuthRecordId(record: { _id?: string; id?: string } | null | undefined) {
	return record?.id ?? record?._id ?? null;
}

function buildInternalAdminMerchantActorId(userId: string) {
	return `${INTERNAL_ADMIN_MERCHANT_ACTOR_PREFIX}${userId}`;
}

function buildInternalAdminMerchantOrganizationId(shopId: string) {
	return `${INTERNAL_ADMIN_MERCHANT_ORGANIZATION_PREFIX}${shopId}`;
}

export function parseInternalAdminMerchantUserId(actorId: string) {
	return actorId.startsWith(INTERNAL_ADMIN_MERCHANT_ACTOR_PREFIX)
		? actorId.slice(INTERNAL_ADMIN_MERCHANT_ACTOR_PREFIX.length) || null
		: null;
}

function buildMerchantActor(args: {
	member: BetterAuthMemberRecord;
	organization: BetterAuthOrganizationRecord;
	shop: Doc<"shops">;
	user: BetterAuthUserRecord;
}): MerchantActorRecord {
	const name = args.user.name.trim() || args.shop.name;

	return {
		email: args.user.email,
		id: getAuthRecordId(args.member) ?? "",
		initials: toOptionalString(args.member.initials) ?? getInitials(name),
		lastAuthenticatedAt: toOptionalNumber(args.member.lastAuthenticatedAt),
		name,
		organizationId: getAuthRecordId(args.organization) ?? "",
		role: args.member.role,
		sessionId: toOptionalString(args.member.sessionId),
		shopDomain: args.shop.domain,
		shopId: args.shop._id,
		shopifyUserId: args.member.shopifyUserId,
		userId: getAuthRecordId(args.user) ?? "",
	};
}

function buildInternalAdminMerchantLookup(args: {
	shop: Doc<"shops">;
	user: BetterAuthUserRecord;
}): MerchantLookup {
	const userId = getAuthRecordId(args.user) ?? "";
	const actorId = buildInternalAdminMerchantActorId(userId);
	const organizationId = buildInternalAdminMerchantOrganizationId(args.shop._id);
	const createdAt = new Date(args.shop.createdAt);
	const shopifyUserId = `${INTERNAL_ADMIN_MERCHANT_ACTOR_PREFIX}${userId}`;

	return {
		actor: {
			email: args.user.email,
			id: actorId,
			initials: getInitials(args.user.name),
			lastAuthenticatedAt: args.shop.lastAuthenticatedAt ?? null,
			name: args.user.name,
			organizationId,
			role: "admin",
			sessionId: null,
			shopDomain: args.shop.domain,
			shopId: args.shop._id,
			shopifyUserId,
			userId,
		},
		member: {
			createdAt,
			id: actorId,
			initials: getInitials(args.user.name),
			lastAuthenticatedAt: args.shop.lastAuthenticatedAt ?? null,
			organizationId,
			role: "admin",
			sessionId: null,
			shopifyUserId,
			userId,
		},
		organization: {
			createdAt,
			id: organizationId,
			name: args.shop.name,
			planDisplayName: args.shop.planDisplayName,
			shopDomain: args.shop.domain,
			shopId: args.shop._id,
			shopifyShopId: args.shop.shopifyShopId,
			slug: `internal-admin-${args.shop._id}`,
			updatedAt: null,
		},
		shop: args.shop,
		user: args.user,
	};
}

function getMerchantRoles(args: {
	identity?: UserIdentity | null;
	includeAdmin?: boolean;
	memberRole: string;
}) {
	const roles = new Set<string>();
	const viewerRole = mapMerchantMemberRoleToViewerRole(args.memberRole);

	if (viewerRole) {
		roles.add(viewerRole);
	}

	if (args.includeAdmin || hasAdminIdentity(args.identity ?? null)) {
		roles.add("admin");
	}

	return Array.from(roles);
}

async function findAdapterRecord<T>(
	ctx: AuthCtx,
	args: {
		model:
			| "account"
			| "invitation"
			| "jwks"
			| "member"
			| "organization"
			| "session"
			| "user"
			| "verification";
		where?: Array<{
			connector?: "AND" | "OR";
			field: string;
			operator?:
				| "contains"
				| "ends_with"
				| "eq"
				| "gt"
				| "gte"
				| "in"
				| "lt"
				| "lte"
				| "ne"
				| "not_in"
				| "starts_with";
			value: boolean | null | number | number[] | string | string[];
		}>;
	},
) {
	return (await ctx.runQuery(components.betterAuth.adapter.findOne, args)) as T | null;
}

async function findMerchantMembershipsForUser(
	ctx: AuthCtx,
	userId: string,
): Promise<BetterAuthMemberRecord[]> {
	const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
		model: "member",
		paginationOpts: {
			cursor: null,
			numItems: 32,
		},
		where: [
			{
				field: "userId",
				value: userId,
			},
		],
	})) as {
		page: BetterAuthMemberRecord[];
	};

	return result.page;
}

async function findOrganizationsByIds(
	ctx: AuthCtx,
	organizationIds: string[],
): Promise<Map<string, BetterAuthOrganizationRecord>> {
	if (organizationIds.length === 0) {
		return new Map();
	}

	const result = (await ctx.runQuery(components.betterAuth.adapter.findMany, {
		model: "organization",
		paginationOpts: {
			cursor: null,
			numItems: organizationIds.length,
		},
		where: [
			{
				field: "_id",
				operator: "in",
				value: organizationIds,
			},
		],
	})) as {
		page: BetterAuthOrganizationRecord[];
	};

	return new Map(result.page.map((organization) => [organization.id, organization]));
}

async function pickAdminFallbackMembership(
	ctx: MerchantDbCtx,
	memberships: BetterAuthMemberRecord[],
): Promise<BetterAuthMemberRecord | null> {
	const organizationsById = await findOrganizationsByIds(
		ctx,
		Array.from(new Set(memberships.map((membership) => membership.organizationId))),
	);

	const candidates = (
		await Promise.all(
			memberships.map(async (membership) => {
				const organization = organizationsById.get(membership.organizationId);
				const shopId = toOptionalString(organization?.shopId);

				if (!organization || !shopId) {
					return null;
				}

				const shop = await ctx.db.get(shopId as Id<"shops">);

				if (
					!shop ||
					shop.domain !== organization.shopDomain ||
					shop.installStatus !== "connected"
				) {
					return null;
				}

				return {
					lastAuthenticatedAt: toOptionalNumber(membership.lastAuthenticatedAt) ?? 0,
					membership,
				};
			}),
		)
	).filter(
		(
			candidate,
		): candidate is {
			lastAuthenticatedAt: number;
			membership: BetterAuthMemberRecord;
		} => Boolean(candidate),
	);

	candidates.sort((left, right) => right.lastAuthenticatedAt - left.lastAuthenticatedAt);

	return candidates[0]?.membership ?? null;
}

async function pickAdminFallbackShop(ctx: MerchantDbCtx): Promise<Doc<"shops"> | null> {
	const shops = await ctx.db
		.query("shops")
		.withIndex("by_install_status_and_created_at", (query) =>
			query.eq("installStatus", "connected"),
		)
		.order("desc")
		.take(32);

	const ranked = [...shops].sort(
		(left, right) =>
			(right.lastAuthenticatedAt ?? right.createdAt) - (left.lastAuthenticatedAt ?? left.createdAt),
	);

	return ranked[0] ?? null;
}

async function readAdminMerchantContextFromDb(
	ctx: MerchantDbCtx,
	args: {
		isAdmin: boolean;
		user: BetterAuthUserRecord;
	},
): Promise<MerchantLookupResolution | null> {
	if (!args.isAdmin) {
		return null;
	}

	const userId = getAuthRecordId(args.user);

	if (!userId) {
		return null;
	}

	const memberships = await findMerchantMembershipsForUser(ctx, userId);
	const fallbackMembership = await pickAdminFallbackMembership(ctx, memberships);

	if (fallbackMembership) {
		const organization = await findAdapterRecord<BetterAuthOrganizationRecord>(ctx, {
			model: "organization",
			where: [
				{
					field: "_id",
					value: fallbackMembership.organizationId,
				},
			],
		});

		if (!organization) {
			return null;
		}

		const shopId = toOptionalString(organization.shopId);

		if (!shopId) {
			return null;
		}

		const shop = await ctx.db.get(shopId as Id<"shops">);

		if (!shop || shop.domain !== organization.shopDomain || shop.installStatus !== "connected") {
			return null;
		}

		return {
			lookup: {
				actor: buildMerchantActor({
					member: fallbackMembership,
					organization,
					shop,
					user: args.user,
				}),
				member: fallbackMembership,
				organization,
				shop,
				user: args.user,
			},
			source: "admin_single_membership",
		};
	}

	const fallbackShop = await pickAdminFallbackShop(ctx);

	if (!fallbackShop) {
		return null;
	}

	return {
		lookup: buildInternalAdminMerchantLookup({
			shop: fallbackShop,
			user: args.user,
		}),
		source: "admin_connected_shop",
	};
}

async function readMerchantContextResolutionFromDb(
	ctx: MerchantDbCtx,
	identity: UserIdentity,
): Promise<MerchantLookupResolution> {
	const sessionId = getSessionId(identity);

	if (!sessionId) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	const session = await findAdapterRecord<BetterAuthSessionRecord>(ctx, {
		model: "session",
		where: [
			{
				field: "_id",
				value: sessionId,
			},
			{
				field: "expiresAt",
				operator: "gt",
				value: Date.now(),
			},
		],
	});

	if (!session) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	const user = await findAdapterRecord<BetterAuthUserRecord>(ctx, {
		model: "user",
		where: [
			{
				field: "_id",
				value: identity.subject,
			},
		],
	});

	if (!user) {
		throw new Error("Authenticated Better Auth user could not be found.");
	}

	const userId = getAuthRecordId(user);

	if (!userId) {
		throw new Error("Authenticated Better Auth user id could not be resolved.");
	}

	const activeOrganizationId =
		getActiveOrganizationId(identity) ?? session.activeOrganizationId ?? null;
	let organizationId = activeOrganizationId;

	if (!organizationId && (user.role === "admin" || hasAdminIdentity(identity))) {
		const adminResolved = await readAdminMerchantContextFromDb(ctx, {
			isAdmin: user.role === "admin" || hasAdminIdentity(identity),
			user,
		});

		if (adminResolved) {
			return adminResolved;
		}
	}

	if (!organizationId) {
		throw new Error("Protected merchant data requires an active merchant organization.");
	}

	const organization = await findAdapterRecord<BetterAuthOrganizationRecord>(ctx, {
		model: "organization",
		where: [
			{
				field: "_id",
				value: organizationId,
			},
		],
	});

	if (!organization) {
		throw new Error("Authenticated merchant organization could not be found.");
	}

	const resolvedOrganizationId = getAuthRecordId(organization);

	if (!resolvedOrganizationId) {
		throw new Error("Authenticated merchant organization id could not be resolved.");
	}

	const member = await findAdapterRecord<BetterAuthMemberRecord>(ctx, {
		model: "member",
		where: [
			{
				field: "organizationId",
				value: resolvedOrganizationId,
			},
			{
				field: "userId",
				value: userId,
			},
		],
	});

	if (!member) {
		throw new Error("Authenticated merchant membership could not be found.");
	}

	const shopId = toOptionalString(organization.shopId);

	if (!shopId) {
		throw new Error("Authenticated merchant organization is missing its Shopify shop link.");
	}

	const shop = await ctx.db.get(shopId as Id<"shops">);

	if (!shop) {
		throw new Error("Authenticated shop could not be found.");
	}

	if (shop.domain !== organization.shopDomain) {
		throw new Error("Authenticated merchant organization does not match the resolved shop domain.");
	}

	if (shop.installStatus !== "connected") {
		throw new Error("The authenticated shop is not currently connected.");
	}

	return {
		lookup: {
			actor: buildMerchantActor({
				member,
				organization,
				shop,
				user,
			}),
			member,
			organization,
			shop,
			user,
		},
		source: "active_organization",
	};
}

async function readMerchantContextFromDb(
	ctx: MerchantDbCtx,
	identity: UserIdentity,
): Promise<MerchantLookup> {
	return (await readMerchantContextResolutionFromDb(ctx, identity)).lookup;
}

type MerchantBridgeEndpointCtx = {
	context: Parameters<typeof getOrgAdapter>[0];
};

async function ensureMerchantOrganizationAndMembership(
	ctx: MerchantBridgeEndpointCtx,
	body: ShopifyMerchantBridgeBody,
	user: BetterAuthUserRecord,
) {
	const orgAdapter = getOrgAdapter(ctx.context, merchantOrganizationOptions);
	const slug = getShopOrganizationSlug(body.shopDomain);
	const organizationUpdate = {
		name: body.shopName,
		planDisplayName: body.planDisplayName,
		shopDomain: body.shopDomain,
		shopId: body.shopId,
		shopifyShopId: body.shopifyShopId,
		slug,
	};
	const organizationCreate = {
		createdAt: new Date(),
		...organizationUpdate,
	};
	let organization = (await orgAdapter.findOrganizationBySlug(
		slug,
	)) as BetterAuthOrganizationRecord | null;

	if (!organization) {
		organization = (await orgAdapter.createOrganization({
			organization: organizationCreate,
		})) as BetterAuthOrganizationRecord;
	} else {
		const organizationId = getAuthRecordId(organization);

		if (!organizationId) {
			throw new Error("Merchant organization id could not be resolved.");
		}

		organization = (await ctx.context.adapter.update({
			model: "organization",
			update: organizationUpdate,
			where: [
				{
					field: "_id",
					value: organizationId,
				},
			],
		})) as BetterAuthOrganizationRecord;
	}

	const resolvedOrganizationId = getAuthRecordId(organization);

	if (!resolvedOrganizationId) {
		throw new Error("Merchant organization id could not be resolved.");
	}

	const existingMember = (await orgAdapter.findMemberByOrgId({
		organizationId: resolvedOrganizationId,
		userId: user.id,
	})) as BetterAuthMemberRecord | null;
	const memberByShopifyUser =
		existingMember ??
		((await ctx.context.adapter.findOne({
			model: "member",
			where: [
				{
					field: "organizationId",
					value: resolvedOrganizationId,
				},
				{
					field: "shopifyUserId",
					value: body.shopifyUserId,
				},
			],
		})) as BetterAuthMemberRecord | null);
	const memberUpdate = {
		initials: body.initials,
		lastAuthenticatedAt: body.lastAuthenticatedAt,
		sessionId: body.sessionId,
		shopifyUserId: body.shopifyUserId,
		userId: user.id,
	};
	let member = existingMember;

	if (!member && memberByShopifyUser) {
		member = (await ctx.context.adapter.update({
			model: "member",
			update: memberUpdate,
			where: [
				{
					field: "_id",
					value: getAuthRecordId(memberByShopifyUser),
				},
			],
		})) as BetterAuthMemberRecord;
	} else if (member) {
		member = (await ctx.context.adapter.update({
			model: "member",
			update: {
				...memberUpdate,
				role: member.role,
			},
			where: [
				{
					field: "_id",
					value: getAuthRecordId(member),
				},
			],
		})) as BetterAuthMemberRecord;
	} else {
		const existingMembers = (await ctx.context.adapter.findMany({
			limit: 1,
			model: "member",
			where: [
				{
					field: "organizationId",
					value: resolvedOrganizationId,
				},
			],
		})) as BetterAuthMemberRecord[];

		member = (await orgAdapter.createMember({
			...memberUpdate,
			organizationId: resolvedOrganizationId,
			role: existingMembers.length === 0 ? "owner" : "admin",
			userId: user.id,
		})) as BetterAuthMemberRecord;
	}

	return {
		member,
		organization,
	};
}

function shopifyMerchantBridgePlugin() {
	return {
		id: "shopify-merchant-bridge",
		endpoints: {
			signInShopifyBridge: createAuthEndpoint(
				SHOPIFY_MERCHANT_BRIDGE_PATH,
				{
					body: z.object({
						email: z.string().optional(),
						initials: z.string(),
						lastAuthenticatedAt: z.number(),
						name: z.string(),
						planDisplayName: z.string().optional(),
						sessionId: z.string().optional(),
						shopDomain: z.string(),
						shopId: z.string(),
						shopName: z.string(),
						shopifyShopId: z.string().optional(),
						shopifyUserId: z.string(),
					}),
					method: "POST",
				},
				async (ctx) => {
					const requestId =
						ctx.headers?.get(SHOPIFY_MERCHANT_BOOTSTRAP_REQUEST_ID_HEADER) ?? "unknown";
					const body = ctx.body as ShopifyMerchantBridgeBody;
					let stage = "validate_bridge_secret";

					try {
						const bridgeSecret = ctx.headers?.get(SHOPIFY_MERCHANT_BRIDGE_SECRET_HEADER);

						if (bridgeSecret !== ctx.context.secret) {
							throw new APIError("UNAUTHORIZED", {
								message: "Invalid merchant bridge request.",
							});
						}

						stage = "load_candidate_users";
						const normalizedEmail = normalizeBetterAuthEmail(body.email ?? null);
						const accountId = buildMerchantBridgeAccountId({
							shopDomain: body.shopDomain,
							shopifyUserId: body.shopifyUserId,
						});
						const linkedAccount = await ctx.context.internalAdapter.findAccountByProviderId(
							accountId,
							SHOPIFY_MERCHANT_BRIDGE_PROVIDER_ID,
						);
						const accountUser = linkedAccount
							? ((await ctx.context.internalAdapter.findUserById(
									linkedAccount.userId,
								)) as BetterAuthUserRecord | null)
							: null;
						const emailUserMatch = normalizedEmail
							? await ctx.context.internalAdapter.findUserByEmail(normalizedEmail, {
									includeAccounts: true,
								})
							: null;
						const emailUser = (emailUserMatch?.user ?? null) as BetterAuthUserRecord | null;

						stage = "resolve_target_user";
						let targetUser = accountUser ?? emailUser;
						const resolvedEmail =
							normalizedEmail ??
							targetUser?.email ??
							buildMerchantBetterAuthEmail({
								shopDomain: body.shopDomain,
								shopifyUserId: body.shopifyUserId,
							});
						let createdNewUser = false;

						if (!targetUser) {
							stage = "create_target_user";
							const createdUser = await ctx.context.internalAdapter.createOAuthUser(
								{
									email: resolvedEmail,
									emailVerified: Boolean(normalizedEmail),
									name: body.name,
								},
								{
									accountId,
									providerId: SHOPIFY_MERCHANT_BRIDGE_PROVIDER_ID,
								},
							);

							targetUser = createdUser.user as BetterAuthUserRecord;
							createdNewUser = true;
						}

						stage = "sync_shopify_account";
						if (linkedAccount && linkedAccount.userId !== targetUser.id) {
							await ctx.context.internalAdapter.updateAccount(linkedAccount.id, {
								userId: targetUser.id,
							});
						} else if (!linkedAccount && !createdNewUser) {
							await ctx.context.internalAdapter.linkAccount({
								accountId,
								providerId: SHOPIFY_MERCHANT_BRIDGE_PROVIDER_ID,
								userId: targetUser.id,
							});
						}

						stage = "update_target_user";
						const existingUsers = (await ctx.context.adapter.findMany({
							limit: 2,
							model: "user",
						})) as Array<{
							id: string;
						}>;

						targetUser = (await ctx.context.internalAdapter.updateUser(targetUser.id, {
							email: resolvedEmail,
							emailVerified: normalizedEmail ? true : (targetUser.emailVerified ?? false),
							name: body.name,
							role: getMerchantBridgeRole({
								currentRole: targetUser.role,
								existingUsers,
								userId: targetUser.id,
							}),
						})) as BetterAuthUserRecord;

						stage = "ensure_org_membership";
						const { member, organization } = await ensureMerchantOrganizationAndMembership(
							ctx,
							body,
							targetUser,
						);

						stage = "create_session";
						const session = await ctx.context.internalAdapter.createSession(targetUser.id);

						if (!session) {
							throw new APIError("INTERNAL_SERVER_ERROR", {
								message: "Failed to create merchant session.",
							});
						}

						stage = "set_active_organization";
						const orgAdapter = getOrgAdapter(ctx.context, merchantOrganizationOptions);
						await orgAdapter.setActiveOrganization(
							session.token,
							getAuthRecordId(organization),
							ctx,
						);

						stage = "set_session_cookie";
						await setSessionCookie(ctx, {
							session,
							user: toSessionUser(targetUser),
						});

						return ctx.json({
							activeShop: {
								domain: body.shopDomain,
								id: body.shopId,
								installStatus: "connected" as const,
								name: body.shopName,
							},
							betterAuthRole: targetUser.role ?? null,
							merchantRole: member.role,
							viewer: {
								email: targetUser.email,
								id: getAuthRecordId(member) ?? "",
								initials: body.initials,
								name: targetUser.name,
							},
						});
					} catch (error) {
						logShopifyMerchantBridgeFailure({
							emailPresent: Boolean(body.email),
							error: serializeMerchantBridgeError(error),
							requestId,
							shopDomain: body.shopDomain,
							shopId: body.shopId,
							shopifyUserId: body.shopifyUserId,
							stage,
						});

						throw error;
					}
				},
			),
		},
	};
}

export const betterAuthProvider = getAuthConfigProvider({
	basePath: "/api/auth",
	jwks: getOptionalEnv("BETTER_AUTH_JWKS"),
});

export const authComponent = createClient<DataModel, typeof authSchema>(components.betterAuth, {
	local: {
		schema: authSchema,
	},
});

export function createAuthOptions(ctx: AuthCtx) {
	const useSecureCookies = getAuthBaseUrl().startsWith("https://");

	return {
		advanced: {
			defaultCookieAttributes: {
				sameSite: useSecureCookies ? "none" : "lax",
			},
			ipAddress: {
				ipAddressHeaders: [...BETTER_AUTH_IP_HEADERS],
			},
			trustedProxyHeaders: true,
			useSecureCookies,
		},
		basePath: "/api/auth",
		baseURL: getAuthBaseUrl(),
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			sendResetPassword: async ({ user, url, token }) => {
				if (!("runAction" in ctx) || typeof ctx.runAction !== "function") {
					throw new Error("Password reset email requires an action-capable auth context.");
				}

				await ctx.runAction(internal.emailActions.sendPasswordReset, {
					email: user.email,
					name: user.name,
					resetUrl: buildPasswordResetLink(url, token),
				});
			},
		},
		emailVerification: {
			sendVerificationEmail: async ({ user, url }) => {
				if (!("runAction" in ctx) || typeof ctx.runAction !== "function") {
					throw new Error("Verification email requires an action-capable auth context.");
				}

				await ctx.runAction(internal.emailActions.sendVerificationEmail, {
					email: user.email,
					name: user.name,
					verificationUrl: url,
				});
			},
		},
		plugins: [
			admin(),
			anonymous(),
			organization(merchantOrganizationOptions),
			shopifyMerchantBridgePlugin(),
			betterAuthConvexPlugin({
				authConfig: {
					providers: [betterAuthProvider],
				},
				jwks: getOptionalEnv("BETTER_AUTH_JWKS"),
				jwt: {
					definePayload: ({ session }) => ({
						activeOrganizationId:
							typeof session.activeOrganizationId === "string"
								? session.activeOrganizationId
								: undefined,
					}),
				},
				options: {
					basePath: "/api/auth",
				},
			}),
		],
		secret: getAuthSecret(),
		trustedOrigins: getTrustedAuthOrigins(),
	} satisfies BetterAuthOptions;
}

export const createAuth = (ctx: AuthCtx) => betterAuth(createAuthOptions(ctx));

export function hasAdminIdentity(identity: UserIdentity | null) {
	return getIdentityRole(identity) === "admin" || getIdentityRoles(identity).includes("admin");
}

export async function requireAdmin(ctx: AuthCtx) {
	const identity = await ctx.auth.getUserIdentity();

	if (hasAdminIdentity(identity)) {
		return identity;
	}

	const user = (await authComponent.safeGetAuthUser(ctx)) as BetterAuthUserRecord | undefined;

	if (user?.role === "admin") {
		return identity;
	}

	throw new Error("Internal diagnostics require an authenticated admin session.");
}

export const readMerchantClaims = internalQuery({
	args: {},
	handler: async (ctx): Promise<MerchantClaims> => {
		const identity = await ctx.auth.getUserIdentity();
		const authUser = (await authComponent.safeGetAuthUser(ctx)) as BetterAuthUserRecord | undefined;

		if (!identity) {
			throw new Error(
				"Protected merchant data requires an authenticated embedded Shopify session.",
			);
		}

		return toMerchantClaims({
			identity,
			includeAdmin: authUser?.role === "admin",
			lookup: await readMerchantContextFromDb(ctx, identity),
		});
	},
});

async function resolveAdminMerchantContext(
	ctx: MerchantDbCtx,
	user: BetterAuthUserRecord,
): Promise<MerchantLookup | null> {
	return (
		(
			await readAdminMerchantContextFromDb(ctx, {
				isAdmin: user.role === "admin",
				user,
			})
		)?.lookup ?? null
	);
}

function toMerchantClaims(args: {
	identity: UserIdentity | null;
	includeAdmin: boolean;
	lookup: MerchantLookup;
}): MerchantClaims {
	return {
		actorId: args.lookup.actor.id,
		organizationId: args.lookup.actor.organizationId,
		roles: getMerchantRoles({
			identity: args.identity,
			includeAdmin: args.includeAdmin,
			memberRole: args.lookup.member.role,
		}),
		shopDomain: args.lookup.shop.domain,
		shopId: args.lookup.shop._id,
		shopifyUserId: args.lookup.actor.shopifyUserId,
		userId: args.lookup.actor.userId,
	};
}

export const readAdminMerchantClaims = internalQuery({
	args: {
		userId: v.string(),
	},
	handler: async (ctx, args): Promise<MerchantClaims> => {
		const user = await findAdapterRecord<BetterAuthUserRecord>(ctx, {
			model: "user",
			where: [
				{
					field: "_id",
					value: args.userId,
				},
			],
		});

		if (!user) {
			throw new Error("Internal merchant access requires an authenticated admin user.");
		}

		const resolved = await readAdminMerchantContextFromDb(ctx, {
			isAdmin: user.role === "admin",
			user,
		});

		if (!resolved) {
			throw new Error("No connected merchant shop is available for this admin session.");
		}

		return toMerchantClaims({
			identity: null,
			includeAdmin: true,
			lookup: resolved.lookup,
		});
	},
});

export async function requireMerchantClaims(ctx: AuthCtx): Promise<MerchantClaims> {
	const identity = await ctx.auth.getUserIdentity();
	const authUser = (await authComponent.safeGetAuthUser(ctx)) as BetterAuthUserRecord | undefined;

	if (identity !== null) {
		if ("db" in ctx) {
			return toMerchantClaims({
				identity,
				includeAdmin: authUser?.role === "admin",
				lookup: await readMerchantContextFromDb(ctx, identity),
			});
		}

		return await ctx.runQuery(internal.auth.readMerchantClaims, {});
	}

	if (!authUser) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	if ("db" in ctx) {
		const resolved = await resolveAdminMerchantContext(ctx, authUser);

		if (resolved) {
			return toMerchantClaims({
				identity: null,
				includeAdmin: authUser.role === "admin",
				lookup: resolved,
			});
		}
	} else {
		try {
			return await ctx.runQuery(internal.auth.readAdminMerchantClaims, {
				userId: authUser.id,
			});
		} catch {
			// Fall through to the shared auth error below.
		}
	}

	throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
}

export async function requireMerchantActor(ctx: MerchantDbCtx): Promise<MerchantContext> {
	const identity = await ctx.auth.getUserIdentity();
	const authUser = (await authComponent.safeGetAuthUser(ctx)) as BetterAuthUserRecord | undefined;
	const resolved =
		identity !== null
			? await readMerchantContextFromDb(ctx, identity)
			: authUser
				? await resolveAdminMerchantContext(ctx, authUser)
				: null;

	if (!resolved) {
		throw new Error("Protected merchant data requires an authenticated embedded Shopify session.");
	}

	return {
		actor: resolved.actor,
		identity,
		organization: resolved.organization,
		roles: getMerchantRoles({
			identity,
			includeAdmin: authUser?.role === "admin",
			memberRole: resolved.member.role,
		}),
		shop: resolved.shop,
		user: resolved.user,
	};
}

export const getCurrentViewer = query({
	args: {},
	handler: async (ctx): Promise<AppViewerContext | null> => {
		const identity = await ctx.auth.getUserIdentity();
		const user = (await authComponent.safeGetAuthUser(ctx)) as BetterAuthUserRecord | undefined;
		const betterAuthRole = user?.role ?? null;

		if (identity && user) {
			try {
				const { lookup: merchant, source } = await readMerchantContextResolutionFromDb(
					ctx,
					identity,
				);
				const roles = deriveViewerRoles({
					betterAuthRole: betterAuthRole ?? (hasAdminIdentity(identity) ? "admin" : null),
					merchantRole: merchant.member.role,
				});

				return {
					activeShop: {
						domain: merchant.shop.domain,
						id: merchant.shop._id,
						installStatus: merchant.shop.installStatus,
						name: merchant.shop.name,
					},
					authMode: source === "active_organization" ? "embedded" : "internal",
					roles,
					viewer: {
						email: merchant.user.email,
						id: merchant.user.id,
						initials: merchant.actor.initials,
						name: merchant.user.name,
						roles,
					},
				};
			} catch {
				// No active merchant organization on this session, fall through to admin handling.
			}
		}

		if (!user) {
			return null;
		}

		if (betterAuthRole === "admin") {
			const adminResolved = await resolveAdminMerchantContext(ctx, user);

			if (adminResolved) {
				const roles = deriveViewerRoles({
					betterAuthRole,
					merchantRole: adminResolved.member.role,
				});

				return {
					activeShop: {
						domain: adminResolved.shop.domain,
						id: adminResolved.shop._id,
						installStatus: adminResolved.shop.installStatus,
						name: adminResolved.shop.name,
					},
					authMode: "internal",
					roles,
					viewer: {
						email: adminResolved.user.email,
						id: adminResolved.user.id,
						initials: adminResolved.actor.initials,
						name: adminResolved.user.name,
						roles,
					},
				};
			}
		}

		if (betterAuthRole === "admin") {
			const roles = deriveViewerRoles({
				betterAuthRole,
			});

			return {
				activeShop: null,
				authMode: "internal",
				roles,
				viewer: {
					email: user.email,
					id: user.id,
					initials: getInitials(user.name),
					name: user.name,
					roles,
				},
			};
		}

		return null;
	},
});
