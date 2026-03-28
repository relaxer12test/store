import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;

function getShellHeader(page: Page) {
	return page
		.locator("header")
		.filter({
			has: page.getByRole("link", { name: "Shopify AI Console", exact: true }),
		})
		.first();
}

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
	await submitButton.click();
	await page.waitForURL("**/internal/overview", {
		timeout: 15_000,
	});
}

test.describe("navigation active states", () => {
	test("landing route marks only Marketing current in the shell navigation", async ({ page }) => {
		await page.goto("/");
		await expect(page).toHaveURL(/\/$/);

		const shellHeader = getShellHeader(page);
		const marketingLink = shellHeader.getByRole("link", { name: "Marketing", exact: true });

		await expect(marketingLink).toHaveAttribute("aria-current", "page");
		await expect(marketingLink).toHaveAttribute("data-active-state", "current");
		await expect(shellHeader.locator('[aria-current="page"]')).toHaveCount(1);
	});

	test.skip(
		!adminEmail || !adminPassword,
		"TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env.local.",
	);

	test("merchant settings route highlights shell and console navigation", async ({
		context,
		page,
	}) => {
		await signInAsAdmin(page, context);
		await page.goto("/app/settings");
		await expect(page).toHaveURL(/\/app\/settings$/);

		const shellHeader = getShellHeader(page);
		const merchantAppLink = shellHeader.getByRole("link", { name: "Merchant app", exact: true });
		const consoleNavigation = page.getByRole("navigation", { name: "Console navigation" });
		const settingsLink = consoleNavigation.getByRole("link", { name: /^Settings/ });

		await expect(merchantAppLink).toHaveAttribute("aria-current", "page");
		await expect(merchantAppLink).toHaveAttribute("data-active-state", "current");
		await expect(consoleNavigation.getByRole("link", { name: /^Overview/ })).not.toHaveAttribute(
			"data-active-state",
			"ancestor",
		);
		await expect(consoleNavigation.getByRole("link", { name: /^Overview/ })).not.toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(settingsLink).toHaveAttribute("aria-current", "page");
		await expect(settingsLink).toHaveAttribute("data-active-state", "current");
	});

	test("internal cache route highlights shell and console navigation", async ({
		context,
		page,
	}) => {
		await signInAsAdmin(page, context);
		await page.goto("/internal/cache");
		await expect(page).toHaveURL(/\/internal\/cache(?:\?.*)?$/);

		const shellHeader = getShellHeader(page);
		const internalLink = shellHeader.getByRole("link", { name: "Internal", exact: true });
		const consoleNavigation = page.getByRole("navigation", { name: "Console navigation" });
		const cacheLink = consoleNavigation.getByRole("link", { name: /^Cache/ });

		await expect(internalLink).toHaveAttribute("aria-current", "page");
		await expect(internalLink).toHaveAttribute("data-active-state", "current");
		await expect(consoleNavigation.getByRole("link", { name: /^Overview/ })).not.toHaveAttribute(
			"data-active-state",
			"ancestor",
		);
		await expect(consoleNavigation.getByRole("link", { name: /^Overview/ })).not.toHaveAttribute(
			"aria-current",
			"page",
		);
		await expect(cacheLink).toHaveAttribute("aria-current", "page");
		await expect(cacheLink).toHaveAttribute("data-active-state", "current");
	});
});
