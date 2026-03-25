// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MerchantApprovalCards } from "./merchant-workspace-ui";

const approval = {
	decidedAt: null,
	errorMessage: null,
	id: "approval_1",
	plannedChanges: [
		{
			after: "ARCHIVED",
			before: "ACTIVE",
			label: "Product status",
		},
	],
	requestedAt: "2026-03-25T12:00:00.000Z",
	resultSummary: null,
	riskSummary: "This changes storefront visibility.",
	status: "pending" as const,
	summary: "Archive Trail Pack",
	targetLabel: "Trail Pack",
	targetShopDomain: "acme.myshopify.com",
	targetType: "product",
	tool: "updateProductStatus",
};

describe("MerchantApprovalCards", () => {
	afterEach(() => {
		cleanup();
	});

	it("wires approve and reject actions to the selected approval id", () => {
		const onApprove = vi.fn();
		const onReject = vi.fn();

		render(
			<MerchantApprovalCards
				approvals={[approval]}
				emptyBody="none"
				emptyTitle="none"
				onApprove={onApprove}
				onReject={onReject}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Approve and apply" }));
		fireEvent.click(screen.getByRole("button", { name: "Reject" }));

		expect(onApprove).toHaveBeenCalledWith("approval_1");
		expect(onReject).toHaveBeenCalledWith("approval_1");
	});

	it("shows a busy state while the current approval is executing", () => {
		render(
			<MerchantApprovalCards
				activeApprovalId="approval_1"
				approvals={[approval]}
				emptyBody="none"
				emptyTitle="none"
				onApprove={() => {}}
				onReject={() => {}}
			/>,
		);

		expect(
			(screen.getByRole("button", { name: "Applying..." }) as HTMLButtonElement).disabled,
		).toBe(true);
		expect((screen.getByRole("button", { name: "Reject" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});
});
