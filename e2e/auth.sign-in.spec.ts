import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
async function openSignInPage(page: Page) {
	await page.goto("/");
	const signInLink = page.getByRole("link", { name: "Sign in", exact: true });
	await expect(signInLink).toBeVisible();
	await Promise.all([page.waitForURL(/\/auth\/sign-in$/), signInLink.click()]);
	await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
}

async function signInAsAdmin(
	page: Page,
	context: BrowserContext,
	options?: { submitWithEnter?: boolean },
) {
	await context.clearCookies();
	await openSignInPage(page);
	await page.waitForTimeout(250);

	const emailInput = page.locator('input[name="email"]');
	const passwordInput = page.locator('input[name="password"]');
	const submitButton = page.getByRole("button", { name: "Sign in" });

	await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
	await emailInput.click();
	await emailInput.pressSequentially(adminEmail!);
	await passwordInput.click();
	await passwordInput.pressSequentially(adminPassword!);
	await expect(emailInput).toHaveValue(adminEmail!);
	await expect(passwordInput).toHaveValue(adminPassword!);

	if (options?.submitWithEnter) {
		await passwordInput.press("Enter");
	} else {
		await submitButton.click();
	}

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

		await context.clearCookies();
		await openSignInPage(page);
		await page.waitForTimeout(250);

		const emailInput = page.locator('input[name="email"]');
		const passwordInput = page.locator('input[name="password"]');
		const submitButton = page.getByRole("button", { name: "Sign in" });

		await emailInput.click();
		await emailInput.pressSequentially(adminEmail!);
		await passwordInput.click();
		await passwordInput.pressSequentially(adminPassword!);
		await expect(emailInput).toHaveValue(adminEmail!);
		await expect(passwordInput).toHaveValue(adminPassword!);

		await passwordInput.press("Enter");
		await page.waitForURL("**/internal/overview", {
			timeout: 15_000,
		});

		await expect(page).toHaveURL(/\/internal\/overview$/);
		await expect(page.getByRole("heading", { name: "Watchlist" })).toBeVisible();
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
			"/internal/overview",
			"/internal/shops",
			"/internal/cache",
			"/internal/workflows",
			"/internal/webhooks",
			"/internal/audits",
			"/internal/ai-sessions",
			"/internal/users",
		]) {
			await page.goto(pathname);
			await expect(page.getByText("Something went wrong!")).toHaveCount(0);
			await expect(page.getByText("This route failed to load")).toHaveCount(0);
		}
	});
});
