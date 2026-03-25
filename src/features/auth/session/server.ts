import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { getOptionalConvexUrl } from "@/lib/env";
import {
	PREVIEW_COOKIE_NAME,
	type PreviewSessionMode,
	previewSessionModes,
	type SessionEnvelope,
} from "@/shared/contracts/session";

const SESSION_ENVELOPE_PATH = "/session-envelope";
const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7;

const guestSession: SessionEnvelope = {
	authMode: "none",
	state: "offline",
	viewer: null,
	activeTenant: null,
	activeShop: null,
	roles: [],
	convexToken: null,
};

function isPreviewSessionMode(value: unknown): value is PreviewSessionMode {
	return previewSessionModes.some((mode) => mode === value);
}

function serializePreviewSessionCookie(mode?: PreviewSessionMode) {
	if (!mode) {
		return `${PREVIEW_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
	}

	return `${PREVIEW_COOKIE_NAME}=${mode}; Path=/; Max-Age=${ONE_WEEK_IN_SECONDS}; SameSite=Lax`;
}

export const getSessionEnvelope = createServerFn({ method: "GET" }).handler(async () => {
	const convexUrl = getOptionalConvexUrl();

	if (!convexUrl) {
		return guestSession;
	}

	try {
		const response = await fetch(new URL(SESSION_ENVELOPE_PATH, convexUrl), {
			method: "GET",
			headers: {
				cookie: getRequestHeader("cookie") ?? "",
				"x-forwarded-host": getRequestHeader("host") ?? "",
			},
		});

		if (!response.ok) {
			return guestSession;
		}

		const envelope = (await response.json()) as SessionEnvelope;

		return envelope;
	} catch {
		return guestSession;
	}
});

export const setPreviewSession = createServerFn({ method: "POST" })
	.inputValidator((input: { mode: PreviewSessionMode }) => {
		if (!isPreviewSessionMode(input.mode)) {
			throw new Error("Invalid preview session mode.");
		}

		return input;
	})
	.handler(async ({ data }) => {
		// Temporary preview bridge until Better Auth bootstrap lands in plan 02.
		setResponseHeader("Set-Cookie", serializePreviewSessionCookie(data.mode));

		return {
			redirectTo: data.mode === "ops" ? "/ops" : "/app",
		};
	});

export const clearPreviewSession = createServerFn({ method: "POST" }).handler(async () => {
	setResponseHeader("Set-Cookie", serializePreviewSessionCookie());

	return {
		redirectTo: "/",
	};
});
