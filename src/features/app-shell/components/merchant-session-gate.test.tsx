// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { MerchantSessionGate } from "@/features/app-shell/components/merchant-session-gate";
import { SessionProvider, type SessionManager } from "@/lib/auth-client";
import type { SessionEnvelope } from "@/shared/contracts/session";

const guestSession: SessionEnvelope = {
	authMode: "none",
	state: "ready",
	viewer: null,
	activeShop: null,
	roles: [],
	convexToken: null,
	convexTokenExpiresAt: null,
};

const merchantSession: SessionEnvelope = {
	authMode: "embedded",
	state: "ready",
	viewer: {
		email: "merchant@example.com",
		id: "user_123",
		initials: "ME",
		name: "Merchant Example",
		roles: ["shop_admin"],
	},
	activeShop: {
		domain: "acme.myshopify.com",
		id: "shop_123",
		installStatus: "connected",
		name: "Acme",
	},
	roles: ["shop_admin"],
	convexToken: "convex-token",
	convexTokenExpiresAt: Date.now() + 60_000,
};

function createSessionManager(session: SessionEnvelope): SessionManager {
	return {
		getState: () => session,
		subscribe: () => () => {},
	};
}

function renderWithSession(session: SessionEnvelope, fallback?: ReactNode) {
	return render(
		<SessionProvider manager={createSessionManager(session)}>
			<MerchantSessionGate fallback={fallback}>
				<div>Protected merchant content</div>
			</MerchantSessionGate>
		</SessionProvider>,
	);
}

describe("MerchantSessionGate", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders the fallback without an embedded merchant session", () => {
		renderWithSession(guestSession, <div>Merchant access required</div>);

		expect(screen.queryByText("Protected merchant content")).toBeNull();
		expect(screen.getByText("Merchant access required")).not.toBeNull();
	});

	it("renders children when the embedded merchant session is ready", () => {
		renderWithSession(merchantSession);

		expect(screen.getByText("Protected merchant content")).not.toBeNull();
	});
});
