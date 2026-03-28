import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

async function signInAsAdmin(page: Page, context: BrowserContext) {
	await context.clearCookies();
	await page.goto("/auth/sign-in");
	await page.waitForTimeout(250);

	const emailInput = page.locator('input[name="email"]');
	const passwordInput = page.locator('input[name="password"]');
	const submitButton = page.getByRole("button", { name: "Sign in" });

	await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
	await emailInput.fill(adminEmail!);
	await passwordInput.fill(adminPassword!);
	await expect(emailInput).toHaveValue(adminEmail!);
	await expect(passwordInput).toHaveValue(adminPassword!);
	await submitButton.click();

	await page.waitForURL("**/internal/overview", {
		timeout: 15_000,
	});
}

test.describe("internal admin sign-in", () => {
	test.skip(
		!adminEmail || !adminPassword,
		"TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env.local.",
	);

	test("signs in and reaches internal diagnostics", async ({ context, page }) => {
		const authRequests: string[] = [];
		const directConvexAuthRequests: string[] = [];
		const runtimeErrors: string[] = [];

		page.on("request", (request) => {
			const url = request.url();

			if (url.includes("/api/auth/")) {
				authRequests.push(url);
			}

			if (url.includes(".convex.site") && url.includes("/api/auth/")) {
				directConvexAuthRequests.push(url);
			}
		});
		page.on("console", (message) => {
			if (message.type() === "error") {
				runtimeErrors.push(message.text());
			}
		});
		page.on("pageerror", (error) => {
			runtimeErrors.push(error.message);
		});

		await signInAsAdmin(page, context);
		await expect(page.getByRole("heading", { name: "Internal diagnostics" })).toBeVisible();
		expect(authRequests.some((url) => url.includes("/api/auth/"))).toBe(true);
		expect(directConvexAuthRequests).toEqual([]);
		expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
	});

	test("account dropdown shows email and signs out", async ({ context, page }) => {
		await signInAsAdmin(page, context);

		const accountMenuButton = page.getByRole("button", { name: "Account menu" });

		await expect(accountMenuButton).toBeVisible();
		await accountMenuButton.click();
		await expect(page.getByTitle(adminEmail!)).toBeVisible();

		const signOutButton = page.getByRole("menuitem", { name: "Sign out" });

		await expect(signOutButton).toBeVisible();
		await signOutButton.click();
		await page.waitForURL("**/auth/sign-in", {
			timeout: 15_000,
		});
		await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
	});

	test("internal users renders without Headless UI Fragment runtime errors", async ({
		context,
		page,
	}) => {
		const runtimeErrors: string[] = [];

		page.on("console", (message) => {
			if (message.type() === "error") {
				runtimeErrors.push(message.text());
			}
		});
		page.on("pageerror", (error) => {
			runtimeErrors.push(error.message);
		});

		await signInAsAdmin(page, context);
		await page.goto("/internal/users?dir=asc&limit=25&sort=name");

		await expect(page.getByPlaceholder("Search by name or email")).toBeVisible();
		await expect(page.getByText("Something went wrong!")).toHaveCount(0);
		await expect(page.getByText("This route failed to load")).toHaveCount(0);
		expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
	});

	test("internal routes render without the generic error boundary", async ({ context, page }) => {
		await signInAsAdmin(page, context);

		for (const pathname of [
			"/internal",
			"/internal/ai-chats",
			"/internal/install-state",
			"/internal/cache",
			"/internal/webhooks",
			"/internal/action-audits",
		]) {
			await page.goto(pathname);
			await expect(page.getByRole("heading", { name: "Internal diagnostics" })).toBeVisible();
			await expect(page.getByText("Something went wrong!")).toHaveCount(0);
		}
	});
});
