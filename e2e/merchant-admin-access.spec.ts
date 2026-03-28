import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const merchantRoutes = [
	{ expectedPath: "/app/overview", route: "/app" },
	{ expectedPath: "/app/explorer", route: "/app/explorer" },
	{ expectedPath: "/app/workflows", route: "/app/workflows" },
	{ expectedPath: "/app/settings", route: "/app/settings" },
] as const;

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

test.describe("internal admin merchant access", () => {
	test.skip(
		!adminEmail || !adminPassword,
		"TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env.local.",
	);

	test("internal admin can open merchant copilot", async ({ context, page }) => {
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
		await page.goto("/app/copilot");

		await expect(page).toHaveURL(/\/app\/copilot$/);
		await expect(page.getByRole("heading", { name: "How can I help?" })).toBeVisible();
		expect(runtimeErrors, runtimeErrors.join("\n")).toEqual([]);
	});

	for (const { expectedPath, route } of merchantRoutes) {
		test(`internal admin can open ${expectedPath} without route errors`, async ({
			context,
			page,
		}) => {
			await signInAsAdmin(page, context);
			await page.goto(route);
			await expect(page).toHaveURL(new RegExp(`${expectedPath.replaceAll("/", "\\/")}$`));
			await expect(page.getByText("This route failed to load")).toHaveCount(0);
		});
	}
});
