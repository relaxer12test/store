/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as http from "../http.js";
import type * as merchantApp from "../merchantApp.js";
import type * as merchantAuth from "../merchantAuth.js";
import type * as merchantSessionToken from "../merchantSessionToken.js";
import type * as shopify from "../shopify.js";
import type * as shopifyAdmin from "../shopifyAdmin.js";
import type * as storefrontWidget from "../storefrontWidget.js";
import type * as systemStatus from "../systemStatus.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  http: typeof http;
  merchantApp: typeof merchantApp;
  merchantAuth: typeof merchantAuth;
  merchantSessionToken: typeof merchantSessionToken;
  shopify: typeof shopify;
  shopifyAdmin: typeof shopifyAdmin;
  storefrontWidget: typeof storefrontWidget;
  systemStatus: typeof systemStatus;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
