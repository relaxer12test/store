// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmbeddedAppManager } from "@/integrations/app/embedded";

function setWindowLocation(search: string) {
	window.history.replaceState({}, "", `/app${search}`);
}

describe("embedded app bootstrap manager", () => {
	beforeEach(() => {
		window.sessionStorage.clear();
		setWindowLocation("");
		delete (window as typeof window & { shopify?: unknown }).shopify;
	});

	afterEach(() => {
		delete (window as typeof window & { shopify?: unknown }).shopify;
	});

	it("prefers App Bridge session tokens and persists the host parameter", async () => {
		const host = Buffer.from("admin.shopify.com/store/acme", "utf8").toString("base64url");
		const shopify = {
			idToken: vi.fn(async () => "app-bridge-token"),
		};
		(window as typeof window & { shopify?: typeof shopify }).shopify = shopify;
		setWindowLocation(`?embedded=1&host=${host}&shop=acme.myshopify.com`);

		const manager = createEmbeddedAppManager();
		const state = await manager.ensureReady();

		expect(state.isEmbedded).toBe(true);
		expect(state.host).toBe(host);
		expect(state.sessionToken).toBe("app-bridge-token");
		expect(state.source).toBe("app-bridge");
		expect(window.sessionStorage.getItem("shopify-admin-host")).toBe(host);
	});

	it("falls back to the URL token and persisted host when App Bridge is unavailable", async () => {
		window.sessionStorage.setItem("shopify-admin-host", "persisted-host");
		setWindowLocation("?embedded=1&id_token=url-token&shop=acme.myshopify.com");

		const manager = createEmbeddedAppManager();
		const state = await manager.ensureReady();

		expect(state.isEmbedded).toBe(true);
		expect(state.host).toBe("persisted-host");
		expect(state.sessionToken).toBe("url-token");
		expect(state.source).toBe("url");
	});

	it("waits for App Bridge to become available before settling on an embedded token", async () => {
		vi.useFakeTimers();

		try {
			setWindowLocation("?embedded=1&shop=acme.myshopify.com");

			const manager = createEmbeddedAppManager();
			const ensureReadyPromise = manager.ensureReady();

			setTimeout(() => {
				(window as typeof window & { shopify?: Window["shopify"] }).shopify = {
					idToken: vi.fn(async () => "late-app-bridge-token"),
				};
			}, 100);

			await vi.advanceTimersByTimeAsync(200);

			const state = await ensureReadyPromise;

			expect(state.isEmbedded).toBe(true);
			expect(state.sessionToken).toBe("late-app-bridge-token");
			expect(state.source).toBe("app-bridge");
		} finally {
			vi.useRealTimers();
		}
	});

	it("retries token discovery after an earlier embedded bootstrap completed without App Bridge", async () => {
		vi.useFakeTimers();

		try {
			setWindowLocation("?embedded=1&shop=acme.myshopify.com");

			const manager = createEmbeddedAppManager();
			const firstAttemptPromise = manager.ensureReady();

			await vi.advanceTimersByTimeAsync(1_600);

			const firstAttempt = await firstAttemptPromise;

			expect(firstAttempt.isEmbedded).toBe(true);
			expect(firstAttempt.sessionToken).toBeNull();

			setTimeout(() => {
				(window as typeof window & { shopify?: Window["shopify"] }).shopify = {
					idToken: vi.fn(async () => "recovered-app-bridge-token"),
				};
			}, 100);

			const secondAttemptPromise = manager.ensureReady();

			await vi.advanceTimersByTimeAsync(200);

			const secondAttempt = await secondAttemptPromise;

			expect(secondAttempt.sessionToken).toBe("recovered-app-bridge-token");
			expect(secondAttempt.source).toBe("app-bridge");
		} finally {
			vi.useRealTimers();
		}
	});
});
