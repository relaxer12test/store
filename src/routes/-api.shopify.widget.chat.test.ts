import { describe, expect, it, vi } from "vitest";
import { forwardStorefrontWidgetChatRequest } from "@/lib/api-proxy";

describe("shopify storefront widget chat route", () => {
	it("forwards chat requests to the Convex HTTP actions host", async () => {
		const calls: Array<{
			init?: RequestInit;
			url: string;
		}> = [];
		const fetchImpl: typeof fetch = async (input, init) => {
			const url =
				typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

			calls.push({
				init,
				url,
			});

			return new Response("event: done\ndata: {}\n\n", {
				headers: {
					"Content-Type": "text/event-stream",
				},
				status: 200,
			});
		};

		const response = await forwardStorefrontWidgetChatRequest(
			new Request("https://storeai.ldev.cloud/api/shopify/widget/chat", {
				body: JSON.stringify({
					message: "Show me best sellers",
					sessionId: "session-1234",
					shopDomain: "acme.myshopify.com",
				}),
				headers: {
					"Content-Type": "application/json",
				},
				method: "POST",
			}),
			{
				convexUrl: "https://convex.example",
				fetchImpl,
			},
		);

		expect(calls).toHaveLength(1);
		const firstCall = calls[0];

		expect(firstCall).toBeDefined();

		if (!firstCall) {
			throw new Error("Expected the widget chat route to forward the request.");
		}

		const headers = new Headers(firstCall.init?.headers);

		expect(firstCall.url).toBe("https://convex.example/shopify/widget/chat");
		expect(firstCall.init?.method).toBe("POST");
		expect(headers.get("Accept")).toBe("text/event-stream");
		expect(headers.get("Content-Type")).toBe("application/json");
		expect(JSON.parse((firstCall.init?.body as string | undefined) ?? "{}")).toMatchObject({
			message: "Show me best sellers",
			sessionId: "session-1234",
			shopDomain: "acme.myshopify.com",
		});
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
	});

	it("normalizes empty upstream chat failures into JSON errors", async () => {
		const response = await forwardStorefrontWidgetChatRequest(
			new Request("https://storeai.ldev.cloud/api/shopify/widget/chat", {
				body: JSON.stringify({
					message: "Show me best sellers",
					sessionId: "session-1234",
					shopDomain: "acme.myshopify.com",
				}),
				headers: {
					"Content-Type": "application/json",
				},
				method: "POST",
			}),
			{
				convexUrl: "https://convex.example",
				fetchImpl: vi.fn(
					async () => new Response(null, { status: 503, statusText: "Unavailable" }),
				),
			},
		);

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			error: "Storefront widget chat failed upstream with status 503.",
		});
	});
});
