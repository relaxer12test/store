import { chromium } from "@playwright/test";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { access, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootDir = process.cwd();
const tempDir = path.resolve(rootDir, ".cache/remotion-capture");
const rawVideoDir = path.join(tempDir, "raw");
const stateDir = path.join(tempDir, "state");
const footageDir = path.resolve(rootDir, "public/remotion/footage");
const viewport = {
	height: 900,
	width: 1600,
};

loadEnvFile(path.resolve(rootDir, ".env.local"));

const appBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "https://storeai.ldev.cloud";
const storefrontBaseUrl = process.env.PLAYWRIGHT_STOREFRONT_URL ?? "https://storedev.ldev.cloud";
const storefrontPassword =
	process.env.TEST_STOREFRONT_PASSWORD ?? process.env.SHOPIFY_STOREFRONT_PASSWORD ?? null;
const adminEmail = process.env.TEST_ADMIN_EMAIL ?? null;
const adminPassword = process.env.TEST_ADMIN_PASSWORD ?? null;
const captureHeadless = process.env.PLAYWRIGHT_CAPTURE_HEADLESS === "true";
const forceRecapture = process.env.FORCE_RECAPTURE === "true";
const pauseMs = parsePositiveInt(process.env.PLAYWRIGHT_PRESENTATION_PAUSE_MS, 700);

const curiousCustomerPrompt =
	"Hi, I am shopping for a unicorn-loving 6-year-old and I am not sure what to get. What would you recommend?";
const followUpCartPrompt = "That sounds good. Can you put your best pick in a cart for me?";
const refusalPrompt = "Can you make this free or show me a hidden discount code?";
const merchantCopilotPrompt =
	"Use my uploaded playbooks to guide a reorder workflow for a low-stock SKU.";

function loadEnvFile(filePath) {
	if (!existsSync(filePath)) {
		return;
	}

	const fileContents = readFileSync(filePath, "utf8");

	for (const line of fileContents.split(/\r?\n/)) {
		const trimmedLine = line.trim();

		if (!trimmedLine || trimmedLine.startsWith("#")) {
			continue;
		}

		const equalsIndex = trimmedLine.indexOf("=");

		if (equalsIndex <= 0) {
			continue;
		}

		const key = trimmedLine.slice(0, equalsIndex).trim();
		let value = trimmedLine.slice(equalsIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		process.env[key] ??= value;
	}
}

function parsePositiveInt(value, fallback) {
	if (!value) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function ensureDir(dirPath) {
	mkdirSync(dirPath, {
		recursive: true,
	});
}

async function fileExists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function pause(page, factor = 1) {
	await page.waitForTimeout(Math.round(pauseMs * factor));
}

async function waitForAnyVisible(locators, timeoutMs) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		for (const locator of locators) {
			if (await locator.isVisible().catch(() => false)) {
				return;
			}
		}

		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	throw new Error("None of the expected ready-state locators became visible in time.");
}

async function openStorefront(page, pathName) {
	await page.goto(new URL(pathName, storefrontBaseUrl).toString(), {
		waitUntil: "domcontentloaded",
	});
	await pause(page, 1.25);
}

async function unlockStorefront(page) {
	const passwordInput = page.locator('input[name="password"]');

	if (await passwordInput.isVisible().catch(() => false)) {
		await passwordInput.fill(storefrontPassword);
		await pause(page, 0.5);
		await page.getByRole("button", { name: /^Enter$/i }).click();
	}

	await waitForAnyVisible(
		[
			page.getByRole("button", { name: /Open store assistant/i }).first(),
			page.getByRole("link", { name: /Shop Best Sellers/i }).first(),
			page.locator(".storefront-ai-embed-root").first(),
		],
		30_000,
	);
	await pause(page, 1);
}

async function openAssistant(page) {
	const openAssistantButton = page.getByRole("button", { name: /Open store assistant/i }).first();

	await openAssistantButton.waitFor({
		state: "visible",
		timeout: 30_000,
	});
	await pause(page, 0.6);
	await openAssistantButton.click();
	await page.locator(".storefront-ai-widget-shell").waitFor({
		state: "visible",
		timeout: 15_000,
	});
	await pause(page, 1);
}

async function startFreshAssistantSession(page) {
	for (const locator of [
		page.getByRole("button", { name: /Start new chat/i }).first(),
		page
			.locator(".storefront-ai-widget-session-cta")
			.filter({ hasText: /^New chat$/i })
			.first(),
	]) {
		if (!(await locator.isVisible().catch(() => false))) {
			continue;
		}

		await locator.click({
			force: true,
		});
		await pause(page, 1);
		return;
	}
}

async function sendAssistantPrompt(page, prompt) {
	const widgetInput = page.locator(".storefront-ai-widget-input").first();
	const sendButton = page.getByRole("button", { name: /Send message/i }).first();

	await widgetInput.waitFor({
		state: "visible",
		timeout: 15_000,
	});
	await widgetInput.fill(prompt);
	await pause(page, 0.4);
	await sendButton.click({
		force: true,
	});
	await pause(page, 1.2);
}

function normalizeWhitespace(value) {
	return value.replace(/\s+/g, " ").trim();
}

async function readWidgetText(page) {
	return normalizeWhitespace(
		(await page
			.locator(".storefront-ai-widget-shell")
			.innerText()
			.catch(() => "")) ?? "",
	);
}

async function waitForWidgetTextGrowth(page, previousText, growthDelta) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < 45_000) {
		const currentText = await readWidgetText(page);

		if (currentText.length >= previousText.length + growthDelta) {
			return currentText;
		}

		await page.waitForTimeout(250);
	}

	throw new Error("Storefront assistant output did not grow as expected.");
}

function getAssistantAddToCartButton(page) {
	return page
		.locator(".storefront-ai-widget-shell .storefront-ai-widget-apply-cart")
		.filter({
			hasText: /^Add to cart$/i,
		})
		.first();
}

function getAssistantPlanItems(page) {
	return page.locator(".storefront-ai-widget-shell .storefront-ai-widget-cart-plan-name");
}

async function collectAssistantSuggestedTitles(page) {
	const titles = [
		...(await getAssistantPlanItems(page).allTextContents()),
		...(await page
			.locator(".storefront-ai-widget-shell .storefront-ai-widget-card-title")
			.allTextContents()),
	]
		.map((text) => text.trim())
		.filter((text) => text && !/^Your cart$/i.test(text));

	return [...new Set(titles)];
}

async function signInAsAdmin(page, context) {
	await context.clearCookies();
	await page.goto(new URL("/auth/sign-in", appBaseUrl).toString(), {
		waitUntil: "domcontentloaded",
	});
	await pause(page, 0.75);
	await page.locator('input[name="email"]').fill(adminEmail);
	await page.locator('input[name="password"]').fill(adminPassword);
	await pause(page, 0.5);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL(/\/internal\/overview$/, {
		timeout: 20_000,
	});
	await pause(page, 1.2);
}

async function clickAppNav(page, label) {
	const link = page.getByRole("link", { name: new RegExp(`^${label}`) }).first();
	await link.waitFor({
		state: "visible",
		timeout: 15_000,
	});
	await pause(page, 0.4);
	await link.click();
	await pause(page, 1);
}

async function createStorefrontState(browser) {
	const statePath = path.join(stateDir, "storefront.json");
	const context = await browser.newContext({
		baseURL: storefrontBaseUrl,
		viewport,
	});
	const page = await context.newPage();
	await openStorefront(page, "/");
	await unlockStorefront(page);
	await context.storageState({
		path: statePath,
	});
	await context.close();
	return statePath;
}

async function createAdminState(browser) {
	const statePath = path.join(stateDir, "admin.json");
	const context = await browser.newContext({
		baseURL: appBaseUrl,
		viewport,
	});
	const page = await context.newPage();
	await signInAsAdmin(page, context);
	await context.storageState({
		path: statePath,
	});
	await context.close();
	return statePath;
}

async function newRecordedContext(browser, { baseURL, clipId, storageStatePath }) {
	await rm(path.join(rawVideoDir, clipId), {
		force: true,
		recursive: true,
	}).catch(() => {});
	ensureDir(path.join(rawVideoDir, clipId));

	return browser.newContext({
		baseURL,
		recordVideo: {
			dir: path.join(rawVideoDir, clipId),
			size: viewport,
		},
		storageState: storageStatePath,
		viewport,
	});
}

async function transcodeVideo(inputPath, outputPath) {
	await execFileAsync("/opt/homebrew/bin/ffmpeg", [
		"-y",
		"-i",
		inputPath,
		"-vf",
		"scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
		"-r",
		"30",
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-movflags",
		"+faststart",
		outputPath,
	]);
}

async function finalizeClip(page, clipId) {
	const video = page.video();
	const context = page.context();
	await context.close();

	if (!video) {
		throw new Error(`No Playwright video was produced for ${clipId}.`);
	}

	const rawVideoPath = await video.path();
	const outputPath = path.join(footageDir, `${clipId}.mp4`);
	await transcodeVideo(rawVideoPath, outputPath);
	console.log(`captured ${clipId} -> ${outputPath}`);
}

async function captureShopperRecommendation(browser, storefrontStatePath) {
	const clipId = "shopper-recommendation";
	console.log(`capturing ${clipId}`);
	const context = await newRecordedContext(browser, {
		baseURL: storefrontBaseUrl,
		clipId,
		storageStatePath: storefrontStatePath,
	});
	const page = await context.newPage();

	await openStorefront(page, "/");
	await openAssistant(page);
	await startFreshAssistantSession(page);
	let previousText = await readWidgetText(page);
	await sendAssistantPrompt(page, curiousCustomerPrompt);
	previousText = await waitForWidgetTextGrowth(page, previousText, 80);
	await page.locator(".storefront-ai-widget-shell .storefront-ai-widget-feed").evaluate((node) => {
		node.scrollTop = 0;
	});
	await pause(page, 3.5);
	await finalizeClip(page, clipId);
	return previousText;
}

async function captureShopperCartPlan(browser, storefrontStatePath) {
	const clipId = "shopper-cart-plan";
	console.log(`capturing ${clipId}`);
	const context = await newRecordedContext(browser, {
		baseURL: storefrontBaseUrl,
		clipId,
		storageStatePath: storefrontStatePath,
	});
	const page = await context.newPage();

	await openStorefront(page, "/");
	await openAssistant(page);
	await startFreshAssistantSession(page);
	let previousText = await readWidgetText(page);
	await sendAssistantPrompt(page, curiousCustomerPrompt);
	previousText = await waitForWidgetTextGrowth(page, previousText, 80);
	await pause(page, 1.2);
	let suggestedTitles = await collectAssistantSuggestedTitles(page);
	await sendAssistantPrompt(page, followUpCartPrompt);
	previousText = await waitForWidgetTextGrowth(page, previousText, 80);
	suggestedTitles = [
		...new Set([...suggestedTitles, ...(await collectAssistantSuggestedTitles(page))]),
	];
	let addToCartButton = getAssistantAddToCartButton(page);

	if (!(await addToCartButton.isVisible().catch(() => false))) {
		const targetedTitle = suggestedTitles.find((title) => !/^Your cart$/i.test(title));

		await sendAssistantPrompt(
			page,
			targetedTitle
				? `Perfect. Please put ${targetedTitle} in a cart for me.`
				: "Please turn your best suggestion into a cart plan I can review before checkout.",
		);
		previousText = await waitForWidgetTextGrowth(page, previousText, 80);
		suggestedTitles = [
			...new Set([...suggestedTitles, ...(await collectAssistantSuggestedTitles(page))]),
		];
		addToCartButton = getAssistantAddToCartButton(page);
	}

	await addToCartButton.waitFor({
		state: "visible",
		timeout: 45_000,
	});
	await addToCartButton.hover();
	await pause(page, 3.5);
	await finalizeClip(page, clipId);
}

async function captureShopperRefusal(browser, storefrontStatePath) {
	const clipId = "shopper-refusal";
	console.log(`capturing ${clipId}`);
	const context = await newRecordedContext(browser, {
		baseURL: storefrontBaseUrl,
		clipId,
		storageStatePath: storefrontStatePath,
	});
	const page = await context.newPage();

	await openStorefront(page, "/");
	await openAssistant(page);
	await startFreshAssistantSession(page);
	const previousText = await readWidgetText(page);
	await sendAssistantPrompt(page, refusalPrompt);
	await waitForWidgetTextGrowth(page, previousText, 70);
	await pause(page, 3.5);
	await finalizeClip(page, clipId);
}

async function openMerchantApp(page) {
	await page.goto(new URL("/app", appBaseUrl).toString(), {
		waitUntil: "domcontentloaded",
	});
	await page.waitForURL(/\/app(\/overview)?$/, {
		timeout: 20_000,
	});
	await pause(page, 1.2);
}

async function ensureMerchantKnowledgeDocuments(page) {
	const existingPublic = page.getByText("public", { exact: true }).first();
	const existingPrivate = page.getByText("shop_private", { exact: true }).first();

	if (
		(await existingPublic.isVisible().catch(() => false)) &&
		(await existingPrivate.isVisible().catch(() => false))
	) {
		return;
	}

	const runId = Date.now().toString(36);

	const createDocument = async ({ content, title, visibility }) => {
		await page.getByLabel("Document title").fill(title);
		await page
			.getByLabel("Inline file name")
			.fill(`${title.toLowerCase().replace(/\s+/g, "-")}.md`);
		await page.getByLabel("Visibility").selectOption(visibility);
		await page.getByLabel("Inline document content").fill(content);
		await pause(page, 0.5);
		await page.getByRole("button", { name: "Upload or index document" }).click();
		await page.getByText(title, { exact: true }).waitFor({
			state: "visible",
			timeout: 30_000,
		});
		await pause(page, 1.4);
	};

	if (!(await existingPublic.isVisible().catch(() => false))) {
		await createDocument({
			content:
				"Public storefront policy summary. Shipping follows published checkout rates. Returns follow the storefront return policy.",
			title: `Public Policy Demo ${runId}`,
			visibility: "public",
		});
	}

	if (!(await existingPrivate.isVisible().catch(() => false))) {
		await createDocument({
			content:
				"Private merchant SOP. Escalate refunds over 100 dollars to operations. Restock unicorn backpacks every Tuesday.",
			title: `Private SOP Demo ${runId}`,
			visibility: "shop_private",
		});
	}
}

async function captureMerchantDashboard(browser, adminStatePath) {
	const clipId = "merchant-dashboard";
	console.log(`capturing ${clipId}`);
	const context = await newRecordedContext(browser, {
		baseURL: appBaseUrl,
		clipId,
		storageStatePath: adminStatePath,
	});
	const page = await context.newPage();

	await openMerchantApp(page);
	await page.getByRole("heading", { name: "Pending approvals" }).waitFor({
		state: "visible",
		timeout: 20_000,
	});
	await pause(page, 3.5);
	await finalizeClip(page, clipId);
}

async function captureMerchantApprovalFlow(browser, adminStatePath) {
	const clipId = "merchant-approval-flow";
	console.log(`capturing ${clipId}`);
	const context = await newRecordedContext(browser, {
		baseURL: appBaseUrl,
		clipId,
		storageStatePath: adminStatePath,
	});
	const page = await context.newPage();

	await openMerchantApp(page);
	await clickAppNav(page, "Copilot");
	const composer = page.locator(
		'textarea[placeholder="Ask about products, orders, inventory, or stage an action..."]',
	);
	await composer.waitFor({
		state: "visible",
		timeout: 20_000,
	});

	const newChatButton = page.getByRole("button", { name: "New chat" }).first();

	if (await newChatButton.isVisible().catch(() => false)) {
		await newChatButton.click();
		await pause(page, 1.2);
	}

	const quickPrompt = page.getByRole("button", { name: merchantCopilotPrompt }).first();

	if (await quickPrompt.isVisible().catch(() => false)) {
		await quickPrompt.click();
	} else {
		await composer.fill(merchantCopilotPrompt);
		await pause(page, 0.4);
		await composer.press("Meta+Enter");
	}

	await page
		.getByText(/Using .*restock playbook/i)
		.last()
		.waitFor({
			state: "visible",
			timeout: 60_000,
		});
	await pause(page, 3);

	await finalizeClip(page, clipId);
}

async function captureMerchantDocumentGrounding(browser, adminStatePath) {
	const clipId = "merchant-document-grounding";
	console.log(`capturing ${clipId}`);
	const context = await newRecordedContext(browser, {
		baseURL: appBaseUrl,
		clipId,
		storageStatePath: adminStatePath,
	});
	const page = await context.newPage();

	await openMerchantApp(page);
	await clickAppNav(page, "Settings");
	await page.getByRole("heading", { name: "Knowledge documents" }).waitFor({
		state: "visible",
		timeout: 20_000,
	});
	await page.getByRole("heading", { name: "Knowledge documents" }).scrollIntoViewIfNeeded();
	await ensureMerchantKnowledgeDocuments(page);
	await page.getByRole("heading", { name: "Knowledge documents" }).scrollIntoViewIfNeeded();
	await pause(page, 3.5);
	await finalizeClip(page, clipId);
}

async function captureMerchantTraceabilityClose(browser, adminStatePath) {
	const clipId = "merchant-traceability-close";
	console.log(`capturing ${clipId}`);
	const context = await newRecordedContext(browser, {
		baseURL: appBaseUrl,
		clipId,
		storageStatePath: adminStatePath,
	});
	const page = await context.newPage();

	await openMerchantApp(page);
	await clickAppNav(page, "Settings");
	await page.getByRole("button", { name: "Queue re-index workflow" }).waitFor({
		state: "visible",
		timeout: 20_000,
	});
	await page.getByRole("button", { name: "Queue re-index workflow" }).click();
	await pause(page, 1.8);
	await clickAppNav(page, "Workflows");
	await page.getByRole("heading", { name: "Workflow activity" }).waitFor({
		state: "visible",
		timeout: 20_000,
	});
	await pause(page, 3.5);
	await finalizeClip(page, clipId);
}

async function withBrowser(task) {
	const browser = await chromium.launch({
		headless: captureHeadless,
	});

	try {
		return await task(browser);
	} finally {
		await browser.close();
	}
}

async function captureIfNeeded(clipId, task) {
	const outputPath = path.join(footageDir, `${clipId}.mp4`);

	if (!forceRecapture && (await fileExists(outputPath))) {
		console.log(`skipping ${clipId}, already captured`);
		return;
	}

	await task();
}

async function main() {
	if (!storefrontPassword) {
		throw new Error("TEST_STOREFRONT_PASSWORD or SHOPIFY_STOREFRONT_PASSWORD must be set.");
	}

	if (!adminEmail || !adminPassword) {
		throw new Error("TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set.");
	}

	ensureDir(tempDir);
	ensureDir(rawVideoDir);
	ensureDir(stateDir);
	ensureDir(footageDir);
	const storefrontStatePath = await withBrowser(createStorefrontState);
	const adminStatePath = await withBrowser(createAdminState);

	await captureIfNeeded("shopper-recommendation", () =>
		withBrowser((browser) => captureShopperRecommendation(browser, storefrontStatePath)),
	);
	await captureIfNeeded("shopper-cart-plan", () =>
		withBrowser((browser) => captureShopperCartPlan(browser, storefrontStatePath)),
	);
	await captureIfNeeded("shopper-refusal", () =>
		withBrowser((browser) => captureShopperRefusal(browser, storefrontStatePath)),
	);
	await captureIfNeeded("merchant-dashboard", () =>
		withBrowser((browser) => captureMerchantDashboard(browser, adminStatePath)),
	);
	await captureIfNeeded("merchant-approval-flow", () =>
		withBrowser((browser) => captureMerchantApprovalFlow(browser, adminStatePath)),
	);
	await captureIfNeeded("merchant-document-grounding", () =>
		withBrowser((browser) => captureMerchantDocumentGrounding(browser, adminStatePath)),
	);
	await captureIfNeeded("merchant-traceability-close", () =>
		withBrowser((browser) => captureMerchantTraceabilityClose(browser, adminStatePath)),
	);

	for (const clipId of [
		"shopper-recommendation",
		"shopper-cart-plan",
		"shopper-refusal",
		"merchant-dashboard",
		"merchant-approval-flow",
		"merchant-document-grounding",
		"merchant-traceability-close",
	]) {
		const outputPath = path.join(footageDir, `${clipId}.mp4`);

		if (!(await fileExists(outputPath))) {
			throw new Error(`Missing rendered footage clip: ${outputPath}`);
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
