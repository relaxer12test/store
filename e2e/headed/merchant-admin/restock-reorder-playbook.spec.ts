import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { resolve } from "node:path";

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const fixturePath = resolve(process.cwd(), "e2e/fixtures/restock-reorder-playbook.md");
const presentationPauseMs = parsePositiveInt(process.env.PLAYWRIGHT_PRESENTATION_PAUSE_MS, 500);

function buildCopilotPrompt(documentTitle: string) {
	return `Use the uploaded playbook titled "${documentTitle}" to guide a reorder for Northstar Supply. Stock is down to 9 units and there is no open PO. What steps should I follow?`;
}

test.describe("restock reorder playbook demo", () => {
	test.skip(
		!adminEmail || !adminPassword,
		"TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in .env.local.",
	);

	test("uploads a private playbook and renders deterministic reorder guidance in copilot", async ({
		context,
		page,
	}) => {
		test.slow();
		test.setTimeout(120_000);

		const runId = Date.now().toString();
		const documentTitle = `Northstar Supply restock playbook ${runId}`;
		const copilotPrompt = buildCopilotPrompt(documentTitle);
		const longTimeout = 90_000;

		await signInAsAdmin(page, context);
		await clickShellHeaderLink(page, "Merchant app");
		await page.waitForURL(/\/app\/overview$/, {
			timeout: 20_000,
		});
		await expect(page.getByRole("heading", { name: "Pending approvals" })).toBeVisible({
			timeout: 20_000,
		});
		await expect(page.getByText("This route failed to load")).toHaveCount(0);
		await expect(page.getByText("Something went wrong!")).toHaveCount(0);
		await pause(page, 1.1);

		await clickConsoleLink(page, "Explorer");
		await page.waitForURL(/\/app\/explorer(?:\?.*)?$/, {
			timeout: 20_000,
		});
		await expect(page.getByRole("heading", { name: "Explorer datasets" })).toBeVisible({
			timeout: 20_000,
		});
		await page.getByRole("button", { name: "Documents", exact: true }).click();
		await expect(page.getByPlaceholder("Search rows")).toBeVisible({
			timeout: 20_000,
		});
		await expect(page.getByText("This route failed to load")).toHaveCount(0);
		await expect(page.getByText("Something went wrong!")).toHaveCount(0);
		await pause(page, 1.1);

		await clickConsoleLink(page, "Workflows");
		await page.waitForURL(/\/app\/workflows$/, {
			timeout: 20_000,
		});
		await expect(page.getByRole("heading", { name: "Workflow activity" })).toBeVisible({
			timeout: 20_000,
		});
		await expect(page.getByText("This route failed to load")).toHaveCount(0);
		await expect(page.getByText("Something went wrong!")).toHaveCount(0);
		await pause(page, 1.1);

		await clickConsoleLink(page, "Settings");
		await page.waitForURL(/\/app\/settings$/, {
			timeout: 20_000,
		});
		await expect(
			page.getByRole("heading", { exact: true, name: "Knowledge documents" }),
		).toBeVisible();
		await expect(page.getByText("This route failed to load")).toHaveCount(0);
		await expect(page.getByText("Something went wrong!")).toHaveCount(0);
		await pause(page, 1.1);

		await page.getByLabel("Document title").fill(documentTitle);
		await page.locator('select[name="visibility"]').selectOption("shop_private");
		await page.locator('input[type="file"]').setInputFiles(fixturePath);
		await pause(page, 0.8);
		await page.getByRole("button", { name: "Upload or index document" }).click();
		await pause(page, 1.2);

		const documentArticle = page.locator("article").filter({ hasText: documentTitle }).first();

		await expect(documentArticle).toBeVisible({ timeout: longTimeout });
		await expect(documentArticle).toContainText("processing", { timeout: 30_000 });
		await expect(documentArticle).toContainText("ready", { timeout: longTimeout });
		await expect(documentArticle).toContainText("shop_private");
		await pause(page, 1.2);

		await clickConsoleLink(page, "Copilot");
		await page.waitForURL(/\/app\/copilot$/, {
			timeout: 20_000,
		});
		await expect(page.getByText("Sessions", { exact: true })).toBeVisible();
		await expect(page.getByText("This route failed to load")).toHaveCount(0);
		await expect(page.getByText("Something went wrong!")).toHaveCount(0);
		await page.getByRole("button", { name: "New chat" }).click();
		await pause(page, 1.1);
		await expect(page.getByRole("heading", { name: "How can I help?" })).toBeVisible();

		const composer = page.getByPlaceholder(
			"Ask about products, orders, inventory, or stage an action...",
		);

		await composer.fill(copilotPrompt);
		await pause(page, 0.9);
		await composer.press("Control+Enter");

		await expect(page.getByText("Restock workflow guidance")).toBeVisible({
			timeout: longTimeout,
		});
		await expect(page.getByText("verify on-hand and open POs", { exact: true })).toBeVisible({
			timeout: longTimeout,
		});
		await expect(page.getByText(/45 days of cover/i).first()).toBeVisible({
			timeout: longTimeout,
		});
		await expect(page.getByText(/below 7 units/i).first()).toBeVisible({
			timeout: longTimeout,
		});
		await expect(
			page.getByText(/do not promise ship dates before ETA is confirmed/i).first(),
		).toBeVisible({
			timeout: longTimeout,
		});
		await expect(page.getByText(documentTitle, { exact: false }).first()).toBeVisible({
			timeout: longTimeout,
		});
		await pause(page, 1.2);
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

function getShellHeader(page: Page) {
	return page
		.locator("header")
		.filter({
			has: page.getByRole("link", { name: "Shopify AI Console", exact: true }),
		})
		.first();
}

async function pause(page: Page, factor = 1) {
	await page.waitForTimeout(Math.round(presentationPauseMs * factor));
}

async function clickConsoleLink(page: Page, name: string) {
	const link = getConsoleNavigation(page)
		.getByRole("link", { name: new RegExp(`^${name}`) })
		.first();

	await expect(link).toBeVisible({
		timeout: 20_000,
	});
	await pause(page, 0.4);
	await link.click();
	await pause(page, 0.8);
}

async function clickShellHeaderLink(page: Page, name: string) {
	const link = getShellHeader(page).getByRole("link", { name, exact: true });

	await expect(link).toBeVisible({
		timeout: 20_000,
	});
	await pause(page, 0.4);
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
	const submitButton = page.getByRole("button", { name: "Sign in" });

	await emailInput.click();
	await emailInput.pressSequentially(adminEmail!, { delay: 20 });
	await pause(page, 0.2);
	await passwordInput.click();
	await passwordInput.pressSequentially(adminPassword!, { delay: 20 });
	await pause(page, 0.3);
	await submitButton.click();
	await page.waitForURL(/\/internal\/overview$/, {
		timeout: 20_000,
	});
	await expect(page.getByText("Watchlist", { exact: true })).toBeVisible({
		timeout: 20_000,
	});
	await pause(page, 1);
}
