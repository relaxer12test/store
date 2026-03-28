import { expect, test, type Locator, type Page } from "@playwright/test";

const storefrontBaseUrl = process.env.PLAYWRIGHT_STOREFRONT_URL ?? "https://storedev.ldev.cloud";
const storefrontPassword =
	process.env.TEST_STOREFRONT_PASSWORD ?? process.env.SHOPIFY_STOREFRONT_PASSWORD ?? null;
const launchSlowMoMs = parsePositiveInt(process.env.PLAYWRIGHT_LAUNCH_SLOW_MO_MS, 250);
const presentationPauseMs = parsePositiveInt(process.env.PLAYWRIGHT_PRESENTATION_PAUSE_MS, 600);

const shopifyTestCard = {
	name: process.env.TEST_SHOPIFY_CARD_NAME ?? "Playwright Tester",
	number: process.env.TEST_SHOPIFY_CARD_NUMBER ?? "4242424242424242",
	expiry: process.env.TEST_SHOPIFY_CARD_EXPIRY ?? "12/34",
	securityCode: process.env.TEST_SHOPIFY_CARD_SECURITY_CODE ?? "111",
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

test.describe("storefront checkout", () => {
	test.skip(
		!storefrontPassword,
		"TEST_STOREFRONT_PASSWORD or SHOPIFY_STOREFRONT_PASSWORD must be set for the protected live store.",
	);

	test("buys two live inventory items with a Shopify test card", async ({ page }) => {
		test.setTimeout(6 * 60_000);

		const checkoutProfile = buildCheckoutProfile();

		await test.step("Unlock the protected storefront", async () => {
			await openStorefront(page, "/");
			await unlockStorefront(page);
			await clearCart(page);
		});

		const candidateProductUrls =
			await test.step("Collect live inventory candidates from the storefront", async () => {
				await page.getByRole("link", { name: "Shop Best Sellers" }).click();
				await page.waitForURL("**/collections/frontpage", {
					timeout: 30_000,
				});
				await pause(page, 0.75);

				const bestSellerCandidates = await collectProductUrls(
					page.locator('a[href*="/products/"]'),
				);

				if (bestSellerCandidates.length >= 2) {
					return bestSellerCandidates;
				}

				await openStorefront(page, "/collections/party-shop");
				const partyShopCandidates = await collectProductUrls(page.locator('a[href*="/products/"]'));

				return dedupeUrls([...bestSellerCandidates, ...partyShopCandidates]);
			});

		expect(candidateProductUrls.length).toBeGreaterThanOrEqual(2);

		const addedProducts =
			await test.step("Add two distinct purchasable products to the cart", async () => {
				const added: Array<{ title: string; url: string }> = [];

				for (const productUrl of candidateProductUrls.slice(0, 12)) {
					if (added.length === 2) {
						break;
					}

					const addedProduct = await tryAddProductToCart(page, productUrl, added.length);

					if (!addedProduct) {
						continue;
					}

					added.push(addedProduct);
					await openStorefront(page, "/");
				}

				return added;
			});

		expect(
			addedProducts,
			`Expected to add two products from live inventory. Added: ${addedProducts
				.map((product) => product.title)
				.join(", ")}`,
		).toHaveLength(2);

		await test.step("Review the cart before checkout", async () => {
			await openStorefront(page, "/cart");

			const cartItems = page.locator("#main-cart-items tr.cart-item");

			await expect(cartItems).toHaveCount(2);

			for (const product of addedProducts) {
				await expect(page.locator("#main-cart-items")).toContainText(product.title);
			}

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
		email: `playwright+moonbeam-${runId}@example.com`,
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

async function collectProductUrls(locator: Locator) {
	const hrefs = await locator.evaluateAll((elements) =>
		elements
			.map((element) => element.getAttribute("href"))
			.filter((href): href is string => Boolean(href)),
	);

	return dedupeUrls(
		hrefs.map((href) => {
			const normalizedHref = href.startsWith("http")
				? href
				: new URL(href, storefrontBaseUrl).toString();

			return normalizedHref.split("?")[0]!;
		}),
	);
}

function dedupeUrls(urls: string[]) {
	return [...new Set(urls)];
}

async function tryAddProductToCart(page: Page, productUrl: string, existingLineItems: number) {
	await page.goto(productUrl, {
		waitUntil: "domcontentloaded",
	});
	await pause(page);

	const title = page.locator("main h1").first();

	if (!(await title.isVisible().catch(() => false))) {
		return null;
	}

	const addButton = page.getByRole("button", { name: /^Add to cart$/i }).first();

	if (!(await addButton.isVisible().catch(() => false))) {
		return null;
	}

	if (await addButton.isDisabled().catch(() => true)) {
		return null;
	}

	await title.scrollIntoViewIfNeeded();
	await pause(page, 0.5);

	const productTitle = (await title.textContent())?.trim() ?? productUrl;

	await addButton.click();
	await pause(page, 1);

	const inlineError = page.locator(".product-form__error-message").first();
	const inlineErrorText = ((await inlineError.textContent().catch(() => "")) ?? "").trim();

	if (inlineErrorText) {
		return null;
	}

	await openStorefront(page, "/cart");

	const cartItems = page.locator("#main-cart-items tr.cart-item");
	const cartLineItemCount = await cartItems.count();

	if (cartLineItemCount <= existingLineItems) {
		return null;
	}

	await expect(page.locator("#main-cart-items")).toContainText(productTitle);

	return {
		title: productTitle,
		url: productUrl,
	};
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

	const phoneField = await maybeFindVisibleMainFrameLocator(page, [
		'input[name="phone"]',
		'input[type="tel"]',
		'input[autocomplete="tel"]',
	]);

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
	const cardNameField = await maybeFindVisibleMainFrameLocator(page, [
		'input[autocomplete="cc-name"]',
		'input[name*="card"][name*="name"]',
		'input[id*="card"][id*="name"]',
		'input[placeholder*="Name on card"]',
		'input[placeholder*="Cardholder"]',
	]);

	if (cardNameField) {
		await typeSlowly(cardNameField, card.name);
		await pause(page, 0.5);
	}

	await fillFrameInput(
		page,
		[
			'input[autocomplete="cc-number"]',
			'input[name="number"]',
			'input[placeholder*="Card number"]',
		],
		card.number,
	);
	await fillFrameInput(
		page,
		[
			'input[autocomplete="cc-exp"]',
			'input[name="expiry"]',
			'input[placeholder*="Expiration"]',
			'input[placeholder*="MM / YY"]',
		],
		card.expiry,
	);
	await fillFrameInput(
		page,
		[
			'input[autocomplete="cc-csc"]',
			'input[name="verification_value"]',
			'input[placeholder*="Security code"]',
			'input[placeholder*="CVV"]',
		],
		card.securityCode,
	);
}

async function fillFrameInput(page: Page, selectors: string[], value: string) {
	const locator = await findVisibleFrameLocator(page, selectors);

	await typeSlowly(locator, value);
	await pause(page, 0.5);
}

async function findVisibleFrameLocator(page: Page, selectors: string[], timeoutMs = 30_000) {
	const locator = await waitForVisibleLocator(
		() =>
			page
				.frames()
				.flatMap((frame) => selectors.map((selector) => frame.locator(selector).first())),
		timeoutMs,
	);

	if (!locator) {
		throw new Error(
			`Could not find a visible payment field for selectors: ${selectors.join(", ")}`,
		);
	}

	return locator;
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
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
