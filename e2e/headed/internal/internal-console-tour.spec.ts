import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const presentationPauseMs = parsePositiveInt(process.env.PLAYWRIGHT_PRESENTATION_PAUSE_MS, 500);

const internalStops = [
	{
		checkpoint: "Watchlist",
		checkpointType: "text",
		name: "Overview",
		pathname: /\/internal\/overview$/,
	},
	{
		checkpoint: "Search by domain",
		checkpointType: "placeholder",
		name: "Shops",
		pathname: /\/internal\/shops(?:\?.*)?$/,
	},
	{
		checkpoint: "Search by cache key",
		checkpointType: "placeholder",
		name: "Cache",
		pathname: /\/internal\/cache(?:\?.*)?$/,
	},
	{
		checkpoint: "Search by workflow type",
		checkpointType: "placeholder",
		name: "Workflows",
		pathname: /\/internal\/workflows(?:\?.*)?$/,
	},
	{
		checkpoint: "Search by topic",
		checkpointType: "placeholder",
		name: "Webhooks",
		pathname: /\/internal\/webhooks(?:\?.*)?$/,
	},
	{
		checkpoint: "Search by action",
		checkpointType: "placeholder",
		name: "Audits",
		pathname: /\/internal\/audits(?:\?.*)?$/,
	},
	{
		checkpoint: "Search by session id or thread id",
		checkpointType: "placeholder",
		name: "AI sessions",
		pathname: /\/internal\/ai-sessions(?:\?.*)?$/,
	},
	{
		checkpoint: "Search by name or email",
		checkpointType: "placeholder",
		name: "Users",
		pathname: /\/internal\/users(?:\?.*)?$/,
	},
] as const;

test.describe("internal console presentation tour", () => {
	test.skip(
		!adminEmail || !adminPassword,
		"TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env.local.",
	);

	test("tours internal routes through console navigation", async ({ context, page }) => {
		test.slow();
		test.setTimeout(120_000);

		await signInAsAdmin(page, context);

		for (const stop of internalStops) {
			await expectConsoleLink(page, stop.name);
			await clickConsoleLink(page, stop.name);
			await page.waitForURL(stop.pathname, {
				timeout: 20_000,
			});
			await expectStopCheckpoint(page, stop.checkpoint, stop.checkpointType);
			await expect(page.getByText("This route failed to load")).toHaveCount(0);
			await expect(page.getByText("Something went wrong!")).toHaveCount(0);
			await pause(page, 1.1);
		}
	});
});

function parsePositiveInt(value: string | undefined, fallback: number) {
	if (!value) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);

	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getConsoleNavigation(page: Page) {
	return page.getByRole("navigation", { name: "Console navigation" });
}

async function pause(page: Page, factor = 1) {
	await page.waitForTimeout(Math.round(presentationPauseMs * factor));
}

async function expectConsoleLink(page: Page, name: string) {
	await expect(
		getConsoleNavigation(page)
			.getByRole("link", { name: new RegExp(`^${name}`) })
			.first(),
	).toBeVisible({
		timeout: 20_000,
	});
}

async function expectStopCheckpoint(
	page: Page,
	checkpoint: string,
	checkpointType: "placeholder" | "text",
) {
	const locator =
		checkpointType === "placeholder"
			? page.getByPlaceholder(checkpoint)
			: page.getByText(checkpoint, { exact: true });

	await expect(locator).toBeVisible({
		timeout: 20_000,
	});
}

async function clickConsoleLink(page: Page, name: string) {
	const link = getConsoleNavigation(page)
		.getByRole("link", { name: new RegExp(`^${name}`) })
		.first();

	await link.click();
	await pause(page, 0.8);
}

async function signInAsAdmin(page: Page, context: BrowserContext) {
	await context.clearCookies();
	await page.goto("/", {
		waitUntil: "domcontentloaded",
	});
	await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeVisible();
	await pause(page, 0.4);
	await page.getByRole("link", { name: "Sign in", exact: true }).click();
	await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

	const emailInput = page.locator('input[name="email"]');
	const passwordInput = page.locator('input[name="password"]');

	await emailInput.click();
	await emailInput.pressSequentially(adminEmail!, { delay: 20 });
	await pause(page, 0.2);
	await passwordInput.click();
	await passwordInput.pressSequentially(adminPassword!, { delay: 20 });
	await pause(page, 0.3);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/internal\/overview$/, {
		timeout: 20_000,
	});
	await expect(page.getByText("Watchlist", { exact: true })).toBeVisible({
		timeout: 20_000,
	});
	await pause(page, 1);
}
