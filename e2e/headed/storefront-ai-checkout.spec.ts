import { expect, test, type Frame, type Locator, type Page } from "@playwright/test";

const storefrontBaseUrl = process.env.PLAYWRIGHT_STOREFRONT_URL ?? "https://storedev.ldev.cloud";
const storefrontPassword =
	process.env.TEST_STOREFRONT_PASSWORD ?? process.env.SHOPIFY_STOREFRONT_PASSWORD ?? null;
const launchSlowMoMs = parsePositiveInt(process.env.PLAYWRIGHT_LAUNCH_SLOW_MO_MS, 250);
const presentationPauseMs = parsePositiveInt(process.env.PLAYWRIGHT_PRESENTATION_PAUSE_MS, 600);

const curiousCustomerPrompt =
	"Hi, I am shopping for a unicorn-loving 6-year-old and I am not sure what to get. What would you recommend?";
const followUpCartPrompt = "That sounds good. Can you put your best pick in a cart for me?";

const shopifyTestCard = {
	name: process.env.TEST_SHOPIFY_CARD_NAME ?? "Playwright Tester",
	number: process.env.TEST_SHOPIFY_CARD_NUMBER ?? "4242424242424242",
	expiry: process.env.TEST_SHOPIFY_CARD_EXPIRY ?? "12/34",
	securityCode: process.env.TEST_SHOPIFY_CARD_SECURITY_CODE ?? "111",
};

const bogusGatewayCard = {
	name: process.env.TEST_BOGUS_CARD_NAME ?? "Bogus Gateway",
	number: process.env.TEST_BOGUS_CARD_NUMBER ?? "1",
	expiry: process.env.TEST_BOGUS_CARD_EXPIRY ?? "1234",
	securityCode: process.env.TEST_BOGUS_CARD_SECURITY_CODE ?? "111",
};

test.use({
	baseURL: storefrontBaseUrl,
	launchOptions: {
		slowMo: launchSlowMoMs,
	},
	viewport: {
		width: 1440,
		height: 1100,
	},
});

test.describe("storefront ai checkout", () => {
	test.skip(
		!storefrontPassword,
		"TEST_STOREFRONT_PASSWORD or SHOPIFY_STOREFRONT_PASSWORD must be set for the protected live store.",
	);

	test("creates an order through the storefront AI assistant as a curious shopper", async ({
		page,
	}) => {
		test.setTimeout(7 * 60_000);

		const checkoutProfile = buildCheckoutProfile();

		await test.step("Unlock the protected storefront", async () => {
			await openStorefront(page, "/");
			await unlockStorefront(page);
			await clearCart(page);
		});

		const aiSuggestedTitles = await test.step("Use the storefront AI to build a cart", async () => {
			await openAssistant(page);
			await startFreshAssistantSession(page);

			let previousWidgetText = await readWidgetText(page);

			await sendAssistantPrompt(page, curiousCustomerPrompt);
			previousWidgetText = await waitForWidgetTextGrowth(page, previousWidgetText, 80);
			await pause(page, 1.5);

			const addToCartButton = getAssistantAddToCartButton(page);
			let suggestedTitles = await collectAssistantSuggestedTitles(page);

			if (!(await addToCartButton.isVisible().catch(() => false))) {
				await sendAssistantPrompt(page, followUpCartPrompt);
				previousWidgetText = await waitForWidgetTextGrowth(page, previousWidgetText, 80);
				await pause(page, 1.5);
				suggestedTitles = mergeUniqueTitles(
					suggestedTitles,
					await collectAssistantSuggestedTitles(page),
				);
			}

			if (!(await addToCartButton.isVisible().catch(() => false))) {
				const targetedTitle = suggestedTitles.find((title) => !/^Your cart$/i.test(title));

				if (!targetedTitle) {
					throw new Error(
						"The storefront AI did not surface a product title to target for carting.",
					);
				}

				await sendAssistantPrompt(page, `Perfect. Please put ${targetedTitle} in a cart for me.`);
				previousWidgetText = await waitForWidgetTextGrowth(page, previousWidgetText, 80);
				await pause(page, 1.5);
				suggestedTitles = mergeUniqueTitles(
					suggestedTitles,
					await collectAssistantSuggestedTitles(page),
				);
			}

			await expect(getAssistantPlanItems(page).first()).toBeVisible({
				timeout: 45_000,
			});
			await expect(addToCartButton).toBeVisible({
				timeout: 45_000,
			});

			expect(suggestedTitles.length).toBeGreaterThan(0);

			await addToCartButton.scrollIntoViewIfNeeded();
			await pause(page, 0.75);
			await addToCartButton.click();
			await waitForAssistantCartConfirmation(page);

			return suggestedTitles;
		});

		await test.step("Review the AI-created cart", async () => {
			await openStorefront(page, "/cart");

			const cartItems = page.locator("#main-cart-items tr.cart-item");

			await expect(cartItems.first()).toBeVisible({
				timeout: 30_000,
			});

			const cartTitles = (await page.locator("#main-cart-items .cart-item__name").allTextContents())
				.map(normalizeComparableText)
				.filter(Boolean);
			const aiTitles = aiSuggestedTitles.map(normalizeComparableText).filter(Boolean);
			const hasMatch = cartTitles.some((cartTitle) =>
				aiTitles.some(
					(aiTitle) =>
						cartTitle.includes(aiTitle) || aiTitle.includes(cartTitle) || cartTitle === aiTitle,
				),
			);

			expect(
				hasMatch,
				`Expected at least one cart title to match visible AI output.\nAI titles: ${aiSuggestedTitles.join(
					", ",
				)}\nCart titles: ${cartTitles.join(", ")}`,
			).toBe(true);

			await pause(page, 1.25);
		});

		await test.step("Complete checkout with a test card", async () => {
			const checkoutButton = page.locator("#checkout");

			await checkoutButton.scrollIntoViewIfNeeded();
			await pause(page, 0.75);
			await checkoutButton.click();

			await waitForCheckout(page);
			await fillCheckoutContactAndShipping(page, checkoutProfile);
			await continueCheckoutIfVisible(page, [/Continue to shipping/i, /Continue to payment/i]);
			await selectShippingRateIfNeeded(page);
			await continueCheckoutIfVisible(page, [/Continue to payment/i, /Review order/i]);
			await selectCardPaymentMethodIfNeeded(page);
			await fillPaymentCard(page, shopifyTestCard);
			await placeOrder(page);
			await waitForOrderConfirmation(page);
		});
	});
});

function parsePositiveInt(value: string | undefined, fallback: number) {
	if (!value) {
		return fallback;
	}

	const parsed = Number.parseInt(value, 10);

	return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildCheckoutProfile() {
	const runId = Date.now().toString(36);

	return {
		email: `playwright+moonbeam-ai-${runId}@example.com`,
		firstName: "Moonbeam",
		lastName: "Playwright",
		address1: "350 5th Avenue",
		city: "New York",
		state: "New York",
		postalCode: "10118",
		phone: "2125550100",
	};
}

async function openStorefront(page: Page, path: string) {
	await page.goto(path, {
		waitUntil: "domcontentloaded",
	});
	await pause(page);
}

async function pause(page: Page, factor = 1) {
	await page.waitForTimeout(Math.round(presentationPauseMs * factor));
}

async function unlockStorefront(page: Page) {
	const passwordInput = page.locator('input[name="password"]');

	if (await passwordInput.isVisible().catch(() => false)) {
		await typeSlowly(passwordInput, storefrontPassword!);
		await pause(page, 0.5);
		await page.getByRole("button", { name: /^Enter$/i }).click();
	}

	await expect(page.getByRole("link", { name: "Shop Best Sellers" })).toBeVisible({
		timeout: 30_000,
	});
	await pause(page, 0.75);
}

async function openAssistant(page: Page) {
	const openAssistantButton = page.getByRole("button", { name: /Open store assistant/i }).first();

	await expect(openAssistantButton).toBeVisible({
		timeout: 30_000,
	});
	await pause(page, 0.75);
	await openAssistantButton.click();

	await expect(page.locator(".storefront-ai-widget-shell")).toBeVisible({
		timeout: 15_000,
	});
	await pause(page, 1);
}

async function startFreshAssistantSession(page: Page) {
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

async function sendAssistantPrompt(page: Page, prompt: string) {
	const widgetInput = page.locator(".storefront-ai-widget-input").first();
	const sendMessageButton = page.getByRole("button", { name: /Send message/i }).first();

	await expect(widgetInput).toBeVisible({
		timeout: 15_000,
	});
	await widgetInput.scrollIntoViewIfNeeded();
	await typeSlowly(widgetInput, prompt);
	await pause(page, 0.4);
	await sendMessageButton.click({
		force: true,
	});
	await pause(page, 1.25);
}

async function readWidgetText(page: Page) {
	return normalizeWhitespace(
		(await page
			.locator(".storefront-ai-widget-shell")
			.innerText()
			.catch(() => "")) ?? "",
	);
}

async function waitForWidgetTextGrowth(page: Page, previousText: string, growthDelta: number) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < 45_000) {
		const currentText = await readWidgetText(page);

		if (currentText.length >= previousText.length + growthDelta) {
			return currentText;
		}

		await page.waitForTimeout(250);
	}

	throw new Error("Storefront AI widget text did not grow as expected.");
}

function getAssistantAddToCartButton(page: Page) {
	return page
		.locator(".storefront-ai-widget-shell .storefront-ai-widget-apply-cart")
		.filter({
			hasText: /^Add to cart$/i,
		})
		.first();
}

function getAssistantPlanItems(page: Page) {
	return page.locator(".storefront-ai-widget-shell .storefront-ai-widget-cart-plan-name");
}

async function collectAssistantSuggestedTitles(page: Page) {
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

async function waitForAssistantCartConfirmation(page: Page) {
	const assistantShell = page.locator(".storefront-ai-widget-shell");
	const startedAt = Date.now();

	while (Date.now() - startedAt < 30_000) {
		const widgetText = normalizeWhitespace(
			(await assistantShell.innerText().catch(() => "")) ?? "",
		);

		if (widgetText.includes("Items added to your cart.") || widgetText.includes("Checkout")) {
			await pause(page, 1.25);
			return;
		}

		await page.waitForTimeout(250);
	}

	throw new Error("The storefront AI did not confirm that the cart was updated.");
}

function normalizeWhitespace(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

function normalizeComparableText(value: string) {
	return normalizeWhitespace(value).toLowerCase();
}

function mergeUniqueTitles(...groups: string[][]) {
	return [
		...new Set(
			groups
				.flat()
				.map((title) => title.trim())
				.filter(Boolean),
		),
	];
}

async function clearCart(page: Page) {
	await openStorefront(page, "/cart");

	const cartItems = page.locator("#main-cart-items tr.cart-item");

	while ((await cartItems.count()) > 0) {
		const itemCountBeforeRemoval = await cartItems.count();
		const removeButton = page.locator("#main-cart-items cart-remove-button button").first();

		await removeButton.click();
		await pause(page, 1);

		if (itemCountBeforeRemoval === 1) {
			await expect(page.getByText(/Your cart is empty/i).first()).toBeVisible({
				timeout: 15_000,
			});
			return;
		}

		await expect(cartItems).toHaveCount(itemCountBeforeRemoval - 1, {
			timeout: 15_000,
		});
	}
}

async function waitForCheckout(page: Page) {
	await expect
		.poll(
			() => {
				const currentUrl = new URL(page.url());

				return (
					currentUrl.pathname.includes("checkouts") || currentUrl.pathname.includes("checkout")
				);
			},
			{
				timeout: 45_000,
			},
		)
		.toBe(true);

	await pause(page);
}

async function fillCheckoutContactAndShipping(
	page: Page,
	profile: ReturnType<typeof buildCheckoutProfile>,
) {
	await fillMainFrameInput(page, ['input[name="email"]', 'input[type="email"]'], profile.email);
	await setSelectLikeField(page, {
		value: "United States",
		selectors: ['select[name="countryCode"]', 'select[name="countryCodeV2"]'],
		fallbackSelectors: [
			'input[autocomplete="country-name"]',
			'[role="combobox"][aria-label*="Country"]',
			'[role="combobox"][aria-labelledby*="country"]',
		],
	});
	await fillMainFrameInput(
		page,
		['input[name="firstName"]', 'input[autocomplete="given-name"]'],
		profile.firstName,
	);
	await fillMainFrameInput(
		page,
		['input[name="lastName"]', 'input[autocomplete="family-name"]'],
		profile.lastName,
	);
	await fillMainFrameInput(
		page,
		['input[name="address1"]', 'input[autocomplete="address-line1"]'],
		profile.address1,
	);
	await fillMainFrameInput(
		page,
		['input[name="city"]', 'input[autocomplete="address-level2"]'],
		profile.city,
	);
	await setSelectLikeField(page, {
		value: profile.state,
		selectors: ['select[name="zone"]', 'select[name="zoneCode"]', 'select[name="provinceCode"]'],
		fallbackSelectors: [
			'input[autocomplete="address-level1"]',
			'[role="combobox"][aria-label*="State"]',
			'[role="combobox"][aria-labelledby*="province"]',
		],
	});
	await fillMainFrameInput(
		page,
		['input[name="postalCode"]', 'input[autocomplete="postal-code"]'],
		profile.postalCode,
	);

	const phoneField = await maybeFindVisibleMainFrameLocator(
		page,
		['input[name="phone"]', 'input[type="tel"]', 'input[autocomplete="tel"]'],
		750,
	);

	if (phoneField) {
		await typeSlowly(phoneField, profile.phone);
		await pause(page, 0.5);
	}
}

async function fillMainFrameInput(page: Page, selectors: string[], value: string) {
	const locator = await findVisibleMainFrameLocator(page, selectors);

	await typeSlowly(locator, value);
	await pause(page, 0.5);
}

async function findVisibleMainFrameLocator(page: Page, selectors: string[], timeoutMs = 30_000) {
	const locator = await waitForVisibleLocator(
		() => selectors.map((selector) => page.locator(selector).first()),
		timeoutMs,
	);

	if (!locator) {
		throw new Error(
			`Could not find a visible checkout field for selectors: ${selectors.join(", ")}`,
		);
	}

	return locator;
}

async function maybeFindVisibleMainFrameLocator(
	page: Page,
	selectors: string[],
	timeoutMs = 5_000,
) {
	return await waitForVisibleLocator(
		() => selectors.map((selector) => page.locator(selector).first()),
		timeoutMs,
	);
}

async function setSelectLikeField(
	page: Page,
	options: {
		value: string;
		selectors: string[];
		fallbackSelectors: string[];
	},
) {
	const selectField = await maybeFindVisibleMainFrameLocator(page, options.selectors);

	if (selectField) {
		const tagName = await selectField.evaluate((element) => element.tagName.toLowerCase());

		if (tagName === "select") {
			await selectField.selectOption({ label: options.value });
			await pause(page, 0.75);
			return;
		}
	}

	const fallbackField = await findVisibleMainFrameLocator(page, options.fallbackSelectors);

	await fallbackField.click();
	await pause(page, 0.3);

	const tagName = await fallbackField.evaluate((element) => element.tagName.toLowerCase());

	if (tagName === "input" || tagName === "textarea") {
		await typeSlowly(fallbackField, options.value);

		const option = page.getByRole("option", {
			name: new RegExp(`^${escapeRegExp(options.value)}$`, "i"),
		});

		if (await option.isVisible().catch(() => false)) {
			await option.click();
		} else {
			await fallbackField.press("Enter");
		}
	} else {
		await page
			.getByRole("option", {
				name: new RegExp(`^${escapeRegExp(options.value)}$`, "i"),
			})
			.click();
	}

	await pause(page, 0.75);
}

async function continueCheckoutIfVisible(page: Page, names: RegExp[]) {
	for (const name of names) {
		const button = page.getByRole("button", { name }).first();

		if (!(await button.isVisible().catch(() => false))) {
			continue;
		}

		if (await button.isDisabled().catch(() => false)) {
			continue;
		}

		await button.scrollIntoViewIfNeeded();
		await pause(page, 0.5);
		await button.click();
		await pause(page, 1);
	}
}

async function selectShippingRateIfNeeded(page: Page) {
	const shippingRate = await maybeFindVisibleMainFrameLocator(page, [
		'input[type="radio"][name*="shipping_rate"]',
		'input[type="radio"][name*="delivery"]',
	]);

	if (!shippingRate) {
		return;
	}

	if (!(await shippingRate.isChecked().catch(() => false))) {
		await shippingRate.check();
		await pause(page, 0.75);
	}

	const paymentHeading = page.getByRole("heading", { name: /^Payment$/i }).first();

	if (await paymentHeading.isVisible().catch(() => false)) {
		await paymentHeading.scrollIntoViewIfNeeded();
		await pause(page, 0.6);
	}
}

async function selectCardPaymentMethodIfNeeded(page: Page) {
	for (const locator of [
		page.getByRole("radio", { name: /Credit card/i }).first(),
		page.getByRole("button", { name: /Credit card/i }).first(),
		page.getByText(/^Credit card$/i).first(),
	]) {
		if (!(await locator.isVisible().catch(() => false))) {
			continue;
		}

		await locator.scrollIntoViewIfNeeded();
		await pause(page, 0.4);
		await locator.click();
		await pause(page, 0.75);
		return;
	}
}

async function fillPaymentCard(
	page: Page,
	card: {
		name: string;
		number: string;
		expiry: string;
		securityCode: string;
	},
) {
	const activeCard = (await page
		.getByRole("img", { name: /BOGUS/i })
		.isVisible()
		.catch(() => false))
		? bogusGatewayCard
		: card;

	const cardNameField = await maybeFindVisibleMainFrameLocator(page, [
		'input[autocomplete="cc-name"]',
		'input[name*="card"][name*="name"]',
		'input[id*="card"][id*="name"]',
		'input[placeholder*="Name on card"]',
		'input[placeholder*="Cardholder"]',
	]);

	if (cardNameField) {
		await typeSlowly(cardNameField, activeCard.name);
		await pause(page, 0.5);
	}

	await fillFrameInput(page, ['input[placeholder*="Name on card"]'], activeCard.name, [
		/Name on card/i,
	]);

	await fillFrameInput(
		page,
		[
			'input[autocomplete="cc-number"]',
			'input[name="number"]',
			'input[placeholder*="Card number"]',
		],
		activeCard.number,
		[/^Card number$/i],
	);

	if (activeCard === bogusGatewayCard) {
		await fillBogusExpiryFields(page, activeCard.expiry);
	} else {
		await fillFrameInput(
			page,
			[
				'input[autocomplete="cc-exp"]',
				'input[name="expiry"]',
				'input[placeholder*="Expiration"]',
				'input[placeholder*="MM / YY"]',
			],
			activeCard.expiry,
			[/Expiration date/i, /Expiry date/i],
			"type",
		);
	}

	await fillFrameInput(
		page,
		[
			'input[autocomplete="cc-csc"]',
			'input[name="verification_value"]',
			'input[placeholder*="Security code"]',
			'input[placeholder*="CVV"]',
		],
		activeCard.securityCode,
		[/Security code/i, /CVV/i],
	);
}

async function fillFrameInput(
	page: Page,
	selectors: string[],
	value: string,
	roleNames: RegExp[] = [],
	entryMode: "fill" | "type" = "fill",
) {
	const locator = await findVisibleFrameLocator(page, selectors, roleNames);

	if (entryMode === "type") {
		await typeSlowly(locator, value);
	} else {
		await locator.click({
			force: true,
		});
		await locator.fill(value);
	}
	await pause(page, 0.5);
}

async function fillBogusExpiryFields(page: Page, expiry: string) {
	const expiryDigits = expiry.replace(/\D/g, "").padEnd(4, "0").slice(0, 4);
	const expiryMonth = expiryDigits.slice(0, 2);
	const expiryYear = expiryDigits.slice(2, 4);
	const expiryFrame = await findFrameWithTextboxName(page, /Expiration date/i);

	if (!expiryFrame) {
		throw new Error("Could not find the Bogus expiry frame.");
	}

	const monthInput = expiryFrame.locator("input").nth(2);
	const yearInput = expiryFrame.locator("input").nth(3);

	await monthInput.click({
		force: true,
	});
	await monthInput.fill(expiryMonth);
	await yearInput.click({
		force: true,
	});
	await yearInput.fill(expiryYear);
	await pause(page, 0.5);
}

async function findVisibleFrameLocator(
	page: Page,
	selectors: string[],
	roleNames: RegExp[] = [],
	timeoutMs = 30_000,
) {
	const locator = await waitForVisibleLocator(
		() =>
			page
				.frames()
				.flatMap((frame) => [
					...roleNames.map((roleName) => frame.getByRole("textbox", { name: roleName }).first()),
					...selectors.map((selector) => frame.locator(selector).first()),
				]),
		timeoutMs,
	);

	if (!locator) {
		throw new Error(
			`Could not find a visible payment field for selectors: ${selectors.join(", ")}`,
		);
	}

	return locator;
}

async function findFrameWithTextboxName(page: Page, roleName: RegExp, timeoutMs = 15_000) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		for (const frame of page.frames()) {
			const locator = frame.getByRole("textbox", { name: roleName }).first();

			if (
				(await locator.count().catch(() => 0)) &&
				(await locator.isVisible().catch(() => false))
			) {
				return frame;
			}
		}

		await page.waitForTimeout(250);
	}

	return null as Frame | null;
}

async function waitForVisibleLocator(getLocators: () => Locator[], timeoutMs: number) {
	const startedAt = Date.now();

	while (Date.now() - startedAt < timeoutMs) {
		for (const locator of getLocators()) {
			if (await locator.count().catch(() => 0)) {
				if (await locator.isVisible().catch(() => false)) {
					return locator;
				}
			}
		}

		await new Promise((resolve) => setTimeout(resolve, 250));
	}

	return null;
}

async function typeSlowly(locator: Locator, value: string) {
	await locator.click({
		force: true,
	});
	await locator.fill("");
	await locator.pressSequentially(value, {
		delay: 60,
	});
}

async function placeOrder(page: Page) {
	for (const name of [/Review order/i, /Pay now/i, /Complete order/i, /Place order/i]) {
		const button = page.getByRole("button", { name }).first();

		if (!(await button.isVisible().catch(() => false))) {
			continue;
		}

		if (await button.isDisabled().catch(() => false)) {
			continue;
		}

		await button.scrollIntoViewIfNeeded();
		await pause(page, 0.5);
		await button.click();
		await pause(page, 1.5);
	}
}

async function waitForOrderConfirmation(page: Page) {
	const confirmationText = page.getByText(
		/Thank you for your purchase|Thank you|Your order is confirmed|Order confirmed/i,
	);

	await expect(confirmationText.first()).toBeVisible({
		timeout: 90_000,
	});

	const pageMain = page.locator("main").first();

	if (await pageMain.isVisible().catch(() => false)) {
		await pageMain.scrollIntoViewIfNeeded();
	}

	await pause(page, 2);
	await page.mouse.wheel(0, 500);
	await pause(page, 1.5);
	await page.mouse.wheel(0, -250);
	await pause(page, 2.5);
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
