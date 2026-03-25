import { httpRouter } from "convex/server";
import {
	PREVIEW_COOKIE_NAME,
	type PreviewSessionMode,
	type SessionEnvelope,
} from "../src/shared/contracts/session";
import { httpAction } from "./_generated/server";

const http = httpRouter();

function parseCookies(cookieHeader: string | null) {
	const pairs = (cookieHeader ?? "")
		.split(";")
		.map((pair) => pair.trim())
		.filter(Boolean);

	return Object.fromEntries(
		pairs.map((pair) => {
			const separatorIndex = pair.indexOf("=");

			if (separatorIndex === -1) {
				return [pair, ""];
			}

			const key = pair.slice(0, separatorIndex);
			const value = pair.slice(separatorIndex + 1);

			return [key, decodeURIComponent(value)];
		}),
	);
}

function buildPreviewSession(mode: PreviewSessionMode): SessionEnvelope {
	if (mode === "ops") {
		return {
			authMode: "preview",
			state: "ready",
			viewer: {
				id: "preview-platform-admin",
				name: "Platform Preview",
				email: "ops-preview@growthcapital.dev",
				initials: "PP",
				roles: ["platform_admin"],
			},
			activeTenant: {
				id: "tenant-platform",
				name: "Growth Capital Internal",
				slug: "growth-capital-internal",
			},
			activeShop: {
				id: "shop-platform",
				name: "Internal Sandbox",
				domain: "internal-sandbox.myshopify.com",
				installStatus: "preview",
			},
			roles: ["platform_admin"],
			convexToken: null,
		};
	}

	return {
		authMode: "preview",
		state: "ready",
		viewer: {
			id: "preview-merchant-admin",
			name: "Merchant Preview",
			email: "merchant-preview@growthcapital.dev",
			initials: "MP",
			roles: ["tenant_admin"],
		},
		activeTenant: {
			id: "tenant-northwind",
			name: "Northwind Atelier",
			slug: "northwind-atelier",
		},
		activeShop: {
			id: "shop-northwind",
			name: "Northwind Atelier",
			domain: "northwind-demo.myshopify.com",
			installStatus: "preview",
		},
		roles: ["tenant_admin"],
		convexToken: null,
	};
}

http.route({
	path: "/session-envelope",
	method: "GET",
	handler: httpAction(async (_ctx, request) => {
		const cookies = parseCookies(request.headers.get("cookie"));
		const mode = cookies[PREVIEW_COOKIE_NAME];

		const session =
			mode === "merchant" || mode === "ops"
				? buildPreviewSession(mode)
				: {
						authMode: "none",
						state: "ready",
						viewer: null,
						activeTenant: null,
						activeShop: null,
						roles: [],
						convexToken: null,
					};

		return Response.json(session);
	}),
});

export default http;
