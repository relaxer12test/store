// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchantSessionGate } from "@/features/app-shell/components/merchant-session-gate";

const useAppAuthMock = vi.fn();

vi.mock("@/lib/auth-client", () => ({
	useAppAuth: () => useAppAuthMock(),
}));

describe("MerchantSessionGate", () => {
	afterEach(() => {
		cleanup();
		useAppAuthMock.mockReset();
	});

	it("renders the fallback without merchant access", () => {
		useAppAuthMock.mockReturnValue({
			viewer: null,
		});

		render(
			<MerchantSessionGate fallback={<div>Merchant access required</div>}>
				<div>Protected merchant content</div>
			</MerchantSessionGate>,
		);

		expect(screen.queryByText("Protected merchant content")).toBeNull();
		expect(screen.getByText("Merchant access required")).not.toBeNull();
	});

	it("renders children when merchant access is ready", () => {
		useAppAuthMock.mockReturnValue({
			viewer: {
				activeShop: {
					domain: "acme.myshopify.com",
					id: "shop_1",
					installStatus: "connected",
					name: "Acme",
				},
				authMode: "internal",
				roles: ["admin"],
			},
		});

		render(
			<MerchantSessionGate>
				<div>Protected merchant content</div>
			</MerchantSessionGate>,
		);

		expect(screen.getByText("Protected merchant content")).not.toBeNull();
	});
});
