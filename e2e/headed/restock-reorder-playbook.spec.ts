import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { resolve } from "node:path";

const adminEmail = process.env.TEST_ADMIN_EMAIL;
const adminPassword = process.env.TEST_ADMIN_PASSWORD;
const fixturePath = resolve(process.cwd(), "e2e/fixtures/restock-reorder-playbook.md");

function buildCopilotPrompt(documentTitle: string) {
	return `Use the uploaded playbook titled "${documentTitle}" to guide a reorder for Northstar Supply. Stock is down to 9 units and there is no open PO. What steps should I follow?`;
}

async function gotoWithRetry(page: Page, url: string) {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		try {
			await page.goto(url, {
				waitUntil: "domcontentloaded",
			});
			return;
		} catch (error) {
			if (attempt === 1) {
				throw error;
			}

			await page.waitForTimeout(500);
		}
	}
}

async function signInAsAdmin(page: Page, context: BrowserContext) {
	await context.clearCookies();
	await gotoWithRetry(page, "/auth/sign-in");
	await page.waitForTimeout(250);

	const emailInput = page.locator('input[name="email"]');
	const passwordInput = page.locator('input[name="password"]');
	const submitButton = page.getByRole("button", { name: "Sign in" });

	await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
	await expect(emailInput).toBeEditable();
	await expect(passwordInput).toBeEditable();
	await emailInput.click();
	await emailInput.pressSequentially(adminEmail!, { delay: 20 });
	await passwordInput.click();
	await passwordInput.pressSequentially(adminPassword!, { delay: 20 });
	await expect(emailInput).toHaveValue(adminEmail!);
	await expect(passwordInput).toHaveValue(adminPassword!);
	await submitButton.click();
	await page.waitForURL("**/internal/overview", {
		timeout: 15_000,
	});
	await page.waitForTimeout(600);
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
		await page.goto("/app/settings");
		await page.waitForTimeout(600);

		await expect(
			page.getByRole("heading", { exact: true, name: "Knowledge documents" }),
		).toBeVisible();
		await page.getByLabel("Document title").fill(documentTitle);
		await page.locator('select[name="visibility"]').selectOption("shop_private");
		await page.locator('input[type="file"]').setInputFiles(fixturePath);
		await page.waitForTimeout(600);
		await page.getByRole("button", { name: "Upload or index document" }).click();
		await page.waitForTimeout(800);

		const documentArticle = page.locator("article").filter({ hasText: documentTitle }).first();

		await expect(documentArticle).toBeVisible({ timeout: longTimeout });
		await expect(documentArticle).toContainText("processing", { timeout: 30_000 });
		await expect(documentArticle).toContainText("ready", { timeout: longTimeout });
		await expect(documentArticle).toContainText("shop_private");
		await page.waitForTimeout(800);

		await page.goto("/app/copilot");
		await page.waitForTimeout(600);
		await expect(page.getByText("Sessions")).toBeVisible();
		await page.getByRole("button", { name: "New chat" }).click();
		await page.waitForTimeout(600);
		await expect(page.getByRole("heading", { name: "How can I help?" })).toBeVisible();

		const composer = page.getByPlaceholder(
			"Ask about products, orders, inventory, or stage an action...",
		);

		await composer.fill(copilotPrompt);
		await page.waitForTimeout(600);
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
		await page.waitForTimeout(800);
	});
});
