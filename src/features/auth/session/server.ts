import { createServerFn } from "@tanstack/react-start";
import type { SessionEnvelope } from "@/shared/contracts/session";

const guestSession: SessionEnvelope = {
	authMode: "none",
	state: "ready",
	viewer: null,
	activeShop: null,
	roles: [],
	convexToken: null,
};

export const getSessionEnvelope = createServerFn({ method: "GET" }).handler(
	async () => guestSession,
);
