// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/cata/link", async () => {
	const react = await import("react");

	return {
		Link: react.forwardRef<
			HTMLAnchorElement,
			{ children?: React.ReactNode; href: string } & React.ComponentPropsWithoutRef<"a">
		>(function MockLink({ children, href, ...props }, ref) {
			return (
				<a {...props} href={href} ref={ref}>
					{children}
				</a>
			);
		}),
	};
});

import { ResourceTable } from "@/components/ui/resource";

describe("ResourceTable", () => {
	afterEach(() => {
		cleanup();
	});

	it("renders row links and wires paging controls", () => {
		const onNext = vi.fn();
		const onPrevious = vi.fn();

		render(
			<ResourceTable
				columns={[
					{
						cell: (row: { name: string }) => row.name,
						header: "Name",
					},
				]}
				emptyBody="none"
				emptyTitle="none"
				getRowHref={() => "/internal/shops/shop_1?limit=25"}
				getRowKey={() => "shop_1"}
				getRowLabel={() => "Acme"}
				onNext={onNext}
				onPrevious={onPrevious}
				pageInfo={{
					continueCursor: "cursor_2",
					isDone: false,
				}}
				rows={[
					{
						name: "Acme",
					},
				]}
			/>,
		);

		expect(screen.getByRole("link", { name: "Acme" }).getAttribute("href")).toBe(
			"/internal/shops/shop_1?limit=25",
		);

		fireEvent.click(screen.getByRole("button", { name: "Older" }));
		fireEvent.click(screen.getByRole("button", { name: "Newer" }));

		expect(onNext).toHaveBeenCalledTimes(1);
		expect(onPrevious).toHaveBeenCalledTimes(1);
	});

	it("disables paging controls when cursors are unavailable", () => {
		render(
			<ResourceTable
				columns={[
					{
						cell: (row: { name: string }) => row.name,
						header: "Name",
					},
				]}
				emptyBody="none"
				emptyTitle="none"
				getRowHref={() => "/internal/shops/shop_1"}
				getRowKey={() => "shop_1"}
				getRowLabel={() => "Acme"}
				onNext={null}
				onPrevious={null}
				pageInfo={{
					continueCursor: null,
					isDone: true,
				}}
				rows={[
					{
						name: "Acme",
					},
				]}
			/>,
		);

		expect((screen.getByRole("button", { name: "Older" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
		expect((screen.getByRole("button", { name: "Newer" }) as HTMLButtonElement).disabled).toBe(
			true,
		);
	});
});
