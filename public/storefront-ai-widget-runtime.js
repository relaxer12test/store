(function () {
	var SESSION_KEY_PREFIX = "storefront-ai-session::";

	/* ─── Network helpers (unchanged) ─── */

	function fetchJson(url, options) {
		return fetch(url, options).then(function (response) {
			return response.text().then(function (text) {
				var data = text ? JSON.parse(text) : null;

				if (!response.ok) {
					var message = data && typeof data.error === "string" ? data.error : "Request failed.";
					throw new Error(message);
				}

				return data;
			});
		});
	}

	function fetchEventStream(url, options, handlers) {
		var abortController = typeof AbortController !== "undefined" ? new AbortController() : null;
		var mergedOptions = Object.assign({}, options);

		if (abortController) {
			mergedOptions.signal = abortController.signal;
		}

		var promise = fetch(url, mergedOptions).then(function (response) {
			if (!response.ok) {
				return response.text().then(function (text) {
					var data = null;

					try {
						data = text ? JSON.parse(text) : null;
					} catch {}

					var message =
						data && typeof data.error === "string"
							? data.error
							: "Something went wrong. Please try again.";
					throw new Error(message);
				});
			}

			if (!response.body) {
				throw new Error("Something went wrong. Please try again.");
			}

			var reader = response.body.getReader();
			var decoder = new TextDecoder();
			var buffer = "";

			function dispatchEvent(rawEvent) {
				var eventName = "message";
				var dataLines = [];

				rawEvent.split(/\r?\n/).forEach(function (line) {
					if (line.indexOf("event:") === 0) {
						eventName = line.slice("event:".length).trim() || "message";
						return;
					}

					if (line.indexOf("data:") === 0) {
						dataLines.push(line.slice("data:".length).trim());
					}
				});

				if (dataLines.length === 0) {
					return;
				}

				var payload = null;

				try {
					payload = JSON.parse(dataLines.join("\n"));
				} catch {
					return;
				}

				var handler = handlers && handlers[eventName];

				if (typeof handler === "function") {
					handler(payload);
				}
			}

			function pump() {
				return reader.read().then(function (result) {
					if (result.done) {
						if (buffer.trim()) {
							dispatchEvent(buffer);
						}
						return;
					}

					buffer += decoder.decode(result.value, { stream: true });
					var separatorMatch = buffer.match(/\r?\n\r?\n/);

					while (separatorMatch && typeof separatorMatch.index === "number") {
						dispatchEvent(buffer.slice(0, separatorMatch.index));
						buffer = buffer.slice(separatorMatch.index + separatorMatch[0].length);
						separatorMatch = buffer.match(/\r?\n\r?\n/);
					}

					return pump();
				});
			}

			return pump();
		});

		promise.abort = abortController
			? function () {
					abortController.abort();
				}
			: function () {};

		return promise;
	}

	/* ─── DOM helpers ─── */

	function createElement(tagName, className, textContent) {
		var element = document.createElement(tagName);

		if (className) {
			element.className = className;
		}

		if (typeof textContent === "string") {
			element.textContent = textContent;
		}

		return element;
	}

	function svgIcon(html, width, height) {
		var span = document.createElement("span");
		span.style.display = "inline-flex";
		span.style.alignItems = "center";
		span.style.justifyContent = "center";
		span.innerHTML = html;
		var svg = span.querySelector("svg");
		if (svg) {
			svg.setAttribute("width", String(width || 16));
			svg.setAttribute("height", String(height || 16));
		}
		return span;
	}

	/* ─── SVG Icons ─── */

	var ICON_CLOSE =
		'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/></svg>';

	var ICON_SESSIONS =
		'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6"/><polyline points="8,5 8,8 10.5,9.5"/></svg>';

	var ICON_NEW_CHAT =
		'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/></svg>';

	var ICON_SEND =
		'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="12" x2="8" y2="4"/><polyline points="4,7 8,3 12,7"/></svg>';

	var ICON_SPINNER =
		'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 2a6 6 0 1 0 6 6"/></svg>';

	/* ─── Unicorn SVG (simplified — body only, no sparkles/stars/tail-swish) ─── */

	var UNICORN_SVG =
		'<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="storefront-ai-widget-unicorn-svg">' +
		'<g class="storefront-ai-widget-unicorn-body">' +
		'<path d="M14 28c0-8 5-14 12-14 3 0 5 1 6 3l1-3s1-5-3-8l-2-2s-1 3-2 4c-2-2-5-3-8-2-4 1-7 5-8 10s-1 9 2 12z" fill="currentColor" opacity="0.9"/>' +
		'<path d="M29 4l-2-4-1 5z" fill="#F0D5A8"/>' +
		'<circle cx="23" cy="11" r="1.2" fill="white" opacity="0.9"/>' +
		'<path d="M16 26l-1 6m3-5l0 5m4-5l1 5m3-6l1 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>' +
		'<path d="M14 23c-4-2-6 1-5 4" stroke="#F4C2C2" stroke-width="1.5" stroke-linecap="round" fill="none"/>' +
		"</g></svg>";

	/* ─── Card rendering ─── */

	function createReferenceNode(reference) {
		if (!reference || typeof reference.label !== "string") {
			return null;
		}

		if (typeof reference.url === "string" && reference.url) {
			var anchor = createElement("a", "storefront-ai-widget-reference", reference.label);
			anchor.href = reference.url;
			anchor.rel = "noopener noreferrer";
			anchor.target = "_blank";
			return anchor;
		}

		return createElement("span", "storefront-ai-widget-reference", reference.label);
	}

	function createProductCard(card) {
		var className = "storefront-ai-widget-card storefront-ai-widget-card--product";
		var item;
		var body = createElement("div", "storefront-ai-widget-card-body");

		if (card.imageUrl) {
			className += " storefront-ai-widget-card--product-with-image";
		}

		item = createElement("article", className);
		var title = createElement("h4", "storefront-ai-widget-card-title", card.title);
		var summary = createElement("p", "storefront-ai-widget-card-summary", card.summary);
		var meta = createElement("div", "storefront-ai-widget-card-meta");
		var price = createElement("span", "storefront-ai-widget-card-pill", card.priceLabel);
		var availability = createElement(
			"span",
			"storefront-ai-widget-card-pill storefront-ai-widget-card-pill--availability",
			card.availabilityLabel,
		);

		meta.appendChild(price);
		meta.appendChild(availability);

		if (card.vendor) {
			meta.appendChild(createElement("span", "storefront-ai-widget-card-pill", card.vendor));
		}

		if (card.imageUrl) {
			var media;
			var image = createElement("img", "storefront-ai-widget-card-image");

			image.alt = card.title || "Product image";
			image.decoding = "async";
			image.loading = "lazy";
			image.src = card.imageUrl;

			if (card.href) {
				media = createElement(
					"a",
					"storefront-ai-widget-card-media storefront-ai-widget-card-media--loading",
				);
				media.href = card.href;
				media.rel = "noopener noreferrer";
				media.target = "_blank";
			} else {
				media = createElement(
					"div",
					"storefront-ai-widget-card-media storefront-ai-widget-card-media--loading",
				);
			}

			image.addEventListener("load", function () {
				media.classList.remove("storefront-ai-widget-card-media--loading");
			});

			image.addEventListener("error", function () {
				item.classList.remove("storefront-ai-widget-card--product-with-image");
				if (media && media.parentNode) {
					media.parentNode.removeChild(media);
				}
			});

			media.appendChild(image);
			item.appendChild(media);
		}

		body.appendChild(title);
		body.appendChild(summary);
		body.appendChild(meta);

		if (card.href) {
			var cta = createElement("a", "storefront-ai-widget-card-link", "View product");
			cta.href = card.href;
			cta.rel = "noopener noreferrer";
			cta.target = "_blank";
			body.appendChild(cta);
		}

		item.appendChild(body);

		return item;
	}

	function createCollectionCard(card) {
		var item = createElement(
			"article",
			"storefront-ai-widget-card storefront-ai-widget-card--collection",
		);
		var title = createElement("h4", "storefront-ai-widget-card-title", card.title);
		var summary = createElement("p", "storefront-ai-widget-card-summary", card.summary);

		item.appendChild(title);
		item.appendChild(summary);

		if (typeof card.productCount === "number") {
			item.appendChild(
				createElement("span", "storefront-ai-widget-card-pill", card.productCount + " products"),
			);
		}

		if (card.href) {
			var cta = createElement("a", "storefront-ai-widget-card-link", "Browse collection");
			cta.href = card.href;
			cta.rel = "noopener noreferrer";
			cta.target = "_blank";
			item.appendChild(cta);
		}

		return item;
	}

	function createCartPlanCard(plan, onApply, onCheckout) {
		var card = createElement("section", "storefront-ai-widget-cart-plan");
		var title = createElement("h4", "storefront-ai-widget-card-title", "Cart plan");
		var list = createElement("ul", "storefront-ai-widget-cart-plan-list");
		var actions = createElement("div", "storefront-ai-widget-cart-plan-actions");
		var explanation =
			plan && plan.explanation
				? createElement("p", "storefront-ai-widget-card-summary", plan.explanation)
				: null;

		card.appendChild(title);

		if (explanation) {
			card.appendChild(explanation);
		}

		(plan.items || []).forEach(function (item) {
			var entry = createElement("li", "storefront-ai-widget-cart-plan-item");
			var name = createElement("span", "storefront-ai-widget-cart-plan-name", item.productTitle);
			var detail = createElement(
				"span",
				"storefront-ai-widget-cart-plan-detail",
				(item.variantTitle || "Default") + " x" + item.quantity,
			);

			entry.appendChild(name);
			entry.appendChild(detail);
			list.appendChild(entry);
		});

		card.appendChild(list);

		if (plan.note) {
			card.appendChild(createElement("p", "storefront-ai-widget-cart-plan-note", plan.note));
		}

		var addButton = createElement("button", "storefront-ai-widget-apply-cart", "Add to cart");
		addButton.type = "button";
		addButton.addEventListener("click", function () {
			onApply(plan, addButton);
		});
		actions.appendChild(addButton);

		var checkoutButton = createElement(
			"button",
			"storefront-ai-widget-apply-cart storefront-ai-widget-apply-cart--secondary",
			"Checkout",
		);
		checkoutButton.type = "button";
		checkoutButton.addEventListener("click", function () {
			onCheckout();
		});
		actions.appendChild(checkoutButton);

		card.appendChild(actions);

		return card;
	}

	/* ─── Message rendering ─── */

	function createMessage(role, payload) {
		var item = createElement(
			"div",
			"storefront-ai-widget-message storefront-ai-widget-message--" + role,
		);
		var body = null;

		if (typeof payload.text === "string" && payload.text.trim()) {
			body = createElement("p", "storefront-ai-widget-message-text", payload.text);
			item.appendChild(body);
		}

		if (Array.isArray(payload.cards) && payload.cards.length > 0) {
			var cards = createElement("div", "storefront-ai-widget-cards");
			var hasProductCards = false;

			payload.cards.forEach(function (card) {
				if (card && card.kind === "product") {
					hasProductCards = true;
					cards.appendChild(createProductCard(card));
					return;
				}

				if (card && card.kind === "collection") {
					cards.appendChild(createCollectionCard(card));
				}
			});

			if (cards.childNodes.length > 0) {
				if (hasProductCards) {
					item.classList.add("storefront-ai-widget-message--has-product-grid");
					cards.classList.add("storefront-ai-widget-cards--products");
					if (body) {
						body.classList.add("storefront-ai-widget-message-text--supporting");
					}
				}

				item.appendChild(cards);
			}
		}

		if (
			payload.cartPlan &&
			Array.isArray(payload.cartPlan.items) &&
			payload.cartPlan.items.length > 0
		) {
			item.appendChild(
				createCartPlanCard(payload.cartPlan, payload.onApplyCartPlan, payload.onCheckoutCart),
			);
		}

		if (Array.isArray(payload.references) && payload.references.length > 0) {
			var referenceRow = createElement("div", "storefront-ai-widget-references");

			payload.references.forEach(function (reference) {
				var node = createReferenceNode(reference);

				if (node) {
					referenceRow.appendChild(node);
				}
			});

			if (referenceRow.childNodes.length > 0) {
				item.appendChild(referenceRow);
			}
		}

		return item;
	}

	/* ─── Streaming message ─── */

	function createStreamingAssistantMessage(onApplyCartPlan, onCheckoutCart) {
		var current = createElement(
			"div",
			"storefront-ai-widget-message storefront-ai-widget-message--assistant storefront-ai-widget-message--streaming",
		);

		var typingDots = createElement("div", "storefront-ai-widget-typing");
		typingDots.innerHTML = "<span></span><span></span><span></span>";

		var toolStatus = createElement("span", "storefront-ai-widget-tool-status");
		toolStatus.hidden = true;

		var textNode = createElement("p", "storefront-ai-widget-message-text");
		textNode.hidden = true;

		current.appendChild(toolStatus);
		current.appendChild(typingDots);
		current.appendChild(textNode);

		var hasReceivedText = false;

		function setToolStatus(statusText) {
			if (hasReceivedText) {
				return;
			}
			toolStatus.textContent = statusText;
			toolStatus.hidden = false;
		}

		function setText(text) {
			if (!hasReceivedText && text) {
				hasReceivedText = true;
				typingDots.hidden = true;
				toolStatus.hidden = true;
				textNode.hidden = false;
			}

			textNode.textContent = text || "";
		}

		function replace(reply) {
			var next = createMessage(reply.tone === "refusal" ? "refusal" : "assistant", {
				cards: reply.cards || [],
				cartPlan: reply.cartPlan || null,
				onApplyCartPlan: onApplyCartPlan,
				onCheckoutCart: onCheckoutCart,
				references: reply.references || [],
				text: reply.answer || "",
			});

			if (current.parentNode) {
				current.parentNode.replaceChild(next, current);
			}

			current = next;
			return next;
		}

		return {
			element: current,
			remove: function () {
				if (current.parentNode) {
					current.parentNode.removeChild(current);
				}
			},
			replace: replace,
			setText: setText,
			setToolStatus: setToolStatus,
		};
	}

	function getToolStatusText(toolName) {
		switch (toolName) {
			case "searchCatalog":
			case "getProductDetail":
				return "Searching products...";
			case "compareProducts":
				return "Comparing options...";
			case "searchCollections":
				return "Browsing collections...";
			case "answerPolicyQuestion":
				return "Checking store policies...";
			case "recommendBundle":
				return "Building a bundle...";
			case "buildCartPlan":
				return "Preparing your cart...";
			default:
				return "Thinking...";
		}
	}

	/* ─── Theme editor notice ─── */

	function buildThemeEditorNotice(message) {
		var notice = createElement("div", "storefront-ai-widget-theme-note");
		var title = createElement("strong", "", "Storefront AI embed");
		var body = createElement("p", "", message);
		notice.appendChild(title);
		notice.appendChild(body);
		return notice;
	}

	/* ─── Session ID management ─── */

	function createSessionId() {
		if (window.crypto && typeof window.crypto.randomUUID === "function") {
			return window.crypto.randomUUID();
		}

		return String(Date.now()) + "-" + String(Math.floor(Math.random() * 1000000));
	}

	function getSessionId(shopDomain) {
		var storageKey = SESSION_KEY_PREFIX + shopDomain;

		try {
			var existing = window.localStorage.getItem(storageKey);

			if (existing) {
				return existing;
			}

			var next = createSessionId();
			window.localStorage.setItem(storageKey, next);
			return next;
		} catch {
			return createSessionId();
		}
	}

	function setSessionId(shopDomain, sessionId) {
		var storageKey = SESSION_KEY_PREFIX + shopDomain;

		try {
			window.localStorage.setItem(storageKey, sessionId);
		} catch {}
	}

	function readOptionalDatasetValue(root, key) {
		var value = root.dataset[key];

		if (typeof value !== "string") {
			return undefined;
		}

		value = value.trim();
		return value ? value : undefined;
	}

	function buildPageContext(root) {
		return {
			canonicalUrl: readOptionalDatasetValue(root, "canonicalUrl"),
			collectionHandle: readOptionalDatasetValue(root, "collectionHandle"),
			collectionTitle: readOptionalDatasetValue(root, "collectionTitle"),
			pageType: readOptionalDatasetValue(root, "pageType") || "unknown",
			productHandle: readOptionalDatasetValue(root, "productHandle"),
			productTitle: readOptionalDatasetValue(root, "productTitle"),
		};
	}

	/* ─── Bootstrap ─── */

	function bootstrapRoot(root) {
		if (!(root instanceof HTMLElement) || root.dataset.storefrontAiReady === "true") {
			return;
		}

		root.dataset.storefrontAiReady = "true";

		var apiBase = (root.dataset.apiBase || "").replace(/\/$/, "");
		var shopDomain = root.dataset.shopDomain || "";
		var isThemeEditor = root.dataset.themeEditor === "true";
		var pageContext = buildPageContext(root);
		var pageTitle = readOptionalDatasetValue(root, "pageTitle") || document.title || undefined;

		if (!apiBase || !shopDomain) {
			if (isThemeEditor) {
				root.appendChild(
					buildThemeEditorNotice("The app embed is missing its app base URL or shop domain."),
				);
			}

			return;
		}

		var state = {
			applyingCart: false,
			authPromise: null,
			authToken: null,
			cartVisible: false,
			config: null,
			loadedSessionId: null,
			open: false,
			pending: false,
			suggestionCount: 0,
			sessions: [],
			sessionId: getSessionId(shopDomain),
			view: "chat",
		};

		/* ─── Build DOM ─── */

		var shell = createElement("section", "storefront-ai-widget-shell");

		// Toggle
		var toggle = createElement("button", "storefront-ai-widget-toggle");
		var toggleIcon = document.createElement("span");
		toggleIcon.className = "storefront-ai-widget-toggle-icon";
		toggleIcon.innerHTML = UNICORN_SVG;
		toggle.type = "button";
		toggle.setAttribute("aria-expanded", "false");
		toggle.setAttribute("aria-label", "Open store assistant");
		toggle.appendChild(toggleIcon);

		// Panel
		var panel = createElement("div", "storefront-ai-widget-panel");
		panel.hidden = true;
		panel.setAttribute("role", "dialog");
		panel.setAttribute("aria-label", "Store assistant");

		// Header
		var header = createElement("div", "storefront-ai-widget-header");
		var title = createElement("div", "storefront-ai-widget-title");
		var heading = createElement(
			"span",
			"storefront-ai-widget-heading",
			"Moonbeam Unicorn Concierge",
		);

		var headerActions = createElement("div", "storefront-ai-widget-header-actions");

		var chatsButton = createElement("button", "storefront-ai-widget-header-button");
		chatsButton.type = "button";
		chatsButton.setAttribute("aria-label", "Chat history");
		chatsButton.appendChild(svgIcon(ICON_SESSIONS));

		var newChatButton = createElement("button", "storefront-ai-widget-header-button");
		newChatButton.type = "button";
		newChatButton.setAttribute("aria-label", "Start new chat");
		newChatButton.appendChild(svgIcon(ICON_NEW_CHAT));

		var closeButton = createElement("button", "storefront-ai-widget-header-button");
		closeButton.type = "button";
		closeButton.setAttribute("aria-label", "Close assistant");
		closeButton.appendChild(svgIcon(ICON_CLOSE));

		title.appendChild(heading);
		headerActions.appendChild(chatsButton);
		headerActions.appendChild(newChatButton);
		headerActions.appendChild(closeButton);
		header.appendChild(title);
		header.appendChild(headerActions);

		// Sessions drawer
		var sessionBackdrop = createElement("div", "storefront-ai-widget-session-backdrop");
		var sessionPage = createElement("div", "storefront-ai-widget-session-page");
		var sessionHandle = createElement("div", "storefront-ai-widget-session-handle");
		var sessionHeader = createElement("div", "storefront-ai-widget-session-header");
		var sessionHeaderTitle = createElement(
			"span",
			"storefront-ai-widget-session-header-title",
			"Recent chats",
		);
		var sessionStartButton = createElement(
			"button",
			"storefront-ai-widget-session-cta",
			"New chat",
		);
		sessionStartButton.type = "button";
		var sessionListView = createElement("div", "storefront-ai-widget-session-list");

		sessionHeader.appendChild(sessionHeaderTitle);
		sessionHeader.appendChild(sessionStartButton);
		sessionPage.appendChild(sessionHandle);
		sessionPage.appendChild(sessionHeader);
		sessionPage.appendChild(sessionListView);

		// Feed
		var feed = createElement("div", "storefront-ai-widget-feed");

		// ARIA live region
		var liveRegion = createElement("div", "storefront-ai-widget-sr-only");
		liveRegion.setAttribute("role", "status");
		liveRegion.setAttribute("aria-live", "polite");
		liveRegion.setAttribute("aria-atomic", "false");

		// Suggestions
		var suggestions = createElement("div", "storefront-ai-widget-suggestions");
		suggestions.hidden = true;

		// Form
		var form = createElement("form", "storefront-ai-widget-form");
		var inputWrap = createElement("div", "storefront-ai-widget-input-wrap");
		var input = createElement("textarea", "storefront-ai-widget-input");
		input.placeholder = "Ask anything...";
		input.rows = 1;

		var submit = createElement("button", "storefront-ai-widget-submit");
		submit.type = "submit";
		submit.setAttribute("aria-label", "Send message");
		submit.appendChild(svgIcon(ICON_SEND));

		inputWrap.appendChild(input);
		inputWrap.appendChild(submit);
		form.appendChild(suggestions);
		form.appendChild(inputWrap);

		// Assemble panel
		panel.appendChild(header);
		panel.appendChild(feed);
		panel.appendChild(form);
		panel.appendChild(sessionBackdrop);
		panel.appendChild(sessionPage);
		panel.appendChild(liveRegion);

		// Assemble shell
		shell.appendChild(panel);
		shell.appendChild(toggle);

		/* ─── Auto-grow input ─── */

		function syncInputHeight() {
			input.style.height = "auto";
			input.style.height = Math.min(input.scrollHeight, 120) + "px";
		}

		function syncSubmitVisibility() {
			var hasContent = input.value.trim().length > 0;
			if (hasContent || state.pending) {
				submit.classList.add("storefront-ai-widget-submit--visible");
			} else {
				submit.classList.remove("storefront-ai-widget-submit--visible");
			}
		}

		input.addEventListener("input", function () {
			syncInputHeight();
			syncSubmitVisibility();
		});

		/* ─── Cart detection ─── */

		function isCartUiOpen() {
			if (window.storefrontCartUi && typeof window.storefrontCartUi.isOpen === "function") {
				return window.storefrontCartUi.isOpen();
			}

			var cartDrawer = document.querySelector("cart-drawer");
			var cartNotification = document.getElementById("cart-notification");

			return Boolean(
				(cartDrawer && cartDrawer.classList.contains("active")) ||
				(cartNotification && cartNotification.classList.contains("active")),
			);
		}

		function setCartVisible(nextCartVisible) {
			state.cartVisible = nextCartVisible;
			// Widget stays open when cart opens — they can coexist
			toggle.hidden = nextCartVisible;
		}

		var cartUiObserver = new MutationObserver(function () {
			setCartVisible(isCartUiOpen());
		});

		cartUiObserver.observe(document.body, {
			attributeFilter: ["class"],
			attributes: true,
			childList: true,
			subtree: true,
		});

		/* ─── Pending state ─── */

		function setPending(nextPending) {
			state.pending = nextPending;
			submit.disabled = nextPending;

			if (nextPending) {
				submit.classList.add("storefront-ai-widget-submit--pending");
				submit.innerHTML = "";
				submit.appendChild(svgIcon(ICON_SPINNER));
			} else {
				submit.classList.remove("storefront-ai-widget-submit--pending");
				submit.innerHTML = "";
				submit.appendChild(svgIcon(ICON_SEND));
			}

			syncSubmitVisibility();
		}

		/* ─── View management ─── */

		function syncPanelView() {
			var showingSessions = state.view === "sessions";

			if (showingSessions) {
				sessionPage.classList.add("storefront-ai-widget-session-page--open");
				sessionBackdrop.classList.add("storefront-ai-widget-session-backdrop--visible");
			} else {
				sessionPage.classList.remove("storefront-ai-widget-session-page--open");
				sessionBackdrop.classList.remove("storefront-ai-widget-session-backdrop--visible");
			}

			suggestions.hidden = showingSessions || state.suggestionCount === 0;
		}

		function setView(nextView) {
			state.view = nextView === "sessions" ? "sessions" : "chat";
			syncPanelView();
		}

		function scrollFeedToBottom() {
			feed.scrollTop = feed.scrollHeight;
		}

		/* ─── Suggestions ─── */

		function renderSuggestions(promptSuggestions) {
			suggestions.innerHTML = "";
			state.suggestionCount = Array.isArray(promptSuggestions) ? promptSuggestions.length : 0;

			if (state.suggestionCount === 0) {
				suggestions.hidden = state.view === "sessions";
				return;
			}

			promptSuggestions.forEach(function (promptText) {
				var suggestion = createElement("button", "storefront-ai-widget-suggestion", promptText);
				suggestion.type = "button";
				suggestion.addEventListener("click", function () {
					input.value = promptText;
					syncInputHeight();
					syncSubmitVisibility();
					void sendMessage(promptText);
				});
				suggestions.appendChild(suggestion);
			});

			suggestions.hidden = state.view === "sessions";
		}

		/* ─── Feed helpers ─── */

		function clearFeed() {
			feed.innerHTML = "";
		}

		function appendMessageToFeed(messageElement) {
			messageElement.classList.add("storefront-ai-widget-message--entering");
			feed.appendChild(messageElement);
			scrollFeedToBottom();
			messageElement.addEventListener(
				"animationend",
				function () {
					messageElement.classList.remove("storefront-ai-widget-message--entering");
				},
				{ once: true },
			);
		}

		function buildGreetingReplyPayload() {
			return {
				answer: state.config.greeting,
				cards: [],
				cartPlan: null,
				references: (state.config.knowledgeSources || []).slice(0, 4).map(function (source) {
					return {
						label: source,
						url: /^https?:\/\//i.test(source) ? source : undefined,
					};
				}),
				suggestedPrompts: state.config.quickPrompts || [],
				tone: "answer",
			};
		}

		function seedGreeting() {
			setView("chat");
			clearFeed();
			addAssistantReply(buildGreetingReplyPayload());
			state.loadedSessionId = state.sessionId;
		}

		/* ─── Session list rendering ─── */

		function formatSessionTimestamp(value) {
			var timestamp = Date.parse(value || "");

			if (!Number.isFinite(timestamp)) {
				return "";
			}

			return new Intl.DateTimeFormat(undefined, {
				day: "numeric",
				month: "short",
			}).format(new Date(timestamp));
		}

		function renderSessionList(sessionList) {
			sessionListView.innerHTML = "";
			state.sessions = Array.isArray(sessionList) ? sessionList : [];

			if (state.sessions.length === 0) {
				var emptyState = createElement("div", "storefront-ai-widget-session-empty");
				emptyState.appendChild(createElement("strong", "", "No saved chats yet"));
				emptyState.appendChild(
					createElement("p", "", "Start a new chat and it will appear here after the first reply."),
				);
				sessionListView.appendChild(emptyState);
				return;
			}

			state.sessions.forEach(function (session) {
				var button = createElement("button", "storefront-ai-widget-session");
				var row = createElement("div", "storefront-ai-widget-session-row");
				var content = createElement("div", "storefront-ai-widget-session-stack");
				var titleNode = createElement(
					"span",
					"storefront-ai-widget-session-title",
					session.title || "Chat",
				);
				var metaText = formatSessionTimestamp(session.lastUpdatedAt);
				var metaNode = createElement(
					"span",
					"storefront-ai-widget-session-meta",
					metaText ? "Updated " + metaText : "",
				);
				var previewNode = createElement(
					"p",
					"storefront-ai-widget-session-preview",
					session.lastReplyPreview || "Open this chat to keep going.",
				);

				button.type = "button";
				content.appendChild(titleNode);
				if (metaNode.textContent) {
					content.appendChild(metaNode);
				}
				row.appendChild(content);

				if (session.sessionId === state.sessionId) {
					button.classList.add("is-active");
					row.appendChild(createElement("span", "storefront-ai-widget-session-badge", "Current"));
				}

				button.appendChild(row);
				button.appendChild(previewNode);

				button.addEventListener("click", function () {
					state.sessionId = session.sessionId;
					setSessionId(shopDomain, state.sessionId);
					renderSessionList(state.sessions);
					setView("chat");

					if (state.loadedSessionId === session.sessionId) {
						window.setTimeout(function () {
							input.focus();
						}, 0);
						return;
					}

					void loadSessionDetail(session.sessionId);
				});

				sessionListView.appendChild(button);
			});
		}

		function startNewChat() {
			state.sessionId = createSessionId();
			state.loadedSessionId = null;
			setSessionId(shopDomain, state.sessionId);
			renderSessionList(state.sessions);
			seedGreeting();
			window.setTimeout(function () {
				input.focus();
			}, 0);
		}

		/* ─── Auth ─── */

		function ensureWidgetAuth() {
			if (state.authToken) {
				return Promise.resolve(state.authToken);
			}

			if (state.authPromise) {
				return state.authPromise;
			}

			state.authPromise = fetchJson(apiBase + "/api/shopify/widget/auth", {
				body: "{}",
				credentials: "include",
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				method: "POST",
			})
				.then(function (payload) {
					if (!payload || typeof payload.token !== "string" || !payload.token) {
						throw new Error("Could not connect. Please refresh the page and try again.");
					}

					state.authToken = payload.token;
					return payload.token;
				})
				.finally(function () {
					state.authPromise = null;
				});

			return state.authPromise;
		}

		function clearAuthToken() {
			state.authToken = null;
			state.authPromise = null;
		}

		function fetchWidgetJson(path) {
			return ensureWidgetAuth().then(function (token) {
				return fetchJson(apiBase + path, {
					credentials: "include",
					headers: {
						Accept: "application/json",
						Authorization: "Bearer " + token,
					},
					method: "GET",
				}).catch(function (error) {
					// Retry once on auth failure (token may have expired)
					if (error && error.message && /401|unauthorized|expired/i.test(error.message)) {
						clearAuthToken();
						return ensureWidgetAuth().then(function (freshToken) {
							return fetchJson(apiBase + path, {
								credentials: "include",
								headers: {
									Accept: "application/json",
									Authorization: "Bearer " + freshToken,
								},
								method: "GET",
							});
						});
					}
					throw error;
				});
			});
		}

		/* ─── Session loading ─── */

		function loadSessionList() {
			return fetchWidgetJson(
				"/api/shopify/widget/sessions?shop=" + encodeURIComponent(shopDomain),
			).then(function (payload) {
				var sessions = payload && Array.isArray(payload.sessions) ? payload.sessions : [];
				renderSessionList(sessions);
				return sessions;
			});
		}

		function loadSessionDetail(sessionId) {
			setView("chat");
			clearFeed();
			addSystemMessage("Loading your chat...");

			return fetchWidgetJson(
				"/api/shopify/widget/session?shop=" +
					encodeURIComponent(shopDomain) +
					"&sessionId=" +
					encodeURIComponent(sessionId),
			)
				.then(function (payload) {
					clearFeed();

					if (!payload || !Array.isArray(payload.messages) || payload.messages.length === 0) {
						seedGreeting();
						return;
					}

					var latestReply = null;

					payload.messages.forEach(function (message) {
						var role = message && message.role === "user" ? "user" : "assistant";
						var reply = role === "assistant" && message && message.reply ? message.reply : null;

						if (reply) {
							latestReply = reply;
						}

						feed.appendChild(
							createMessage(reply && reply.tone === "refusal" ? "refusal" : role, {
								cards: reply && Array.isArray(reply.cards) ? reply.cards : [],
								cartPlan: reply && reply.cartPlan ? reply.cartPlan : null,
								onApplyCartPlan: applyCartPlan,
								onCheckoutCart: checkoutCart,
								references: reply && Array.isArray(reply.references) ? reply.references : [],
								text:
									typeof message.body === "string" && message.body
										? message.body
										: reply && typeof reply.answer === "string"
											? reply.answer
											: "",
							}),
						);
					});

					renderSuggestions(
						latestReply && Array.isArray(latestReply.suggestedPrompts)
							? latestReply.suggestedPrompts
							: [],
					);

					state.loadedSessionId = sessionId;
					scrollFeedToBottom();
				})
				.catch(function (error) {
					clearFeed();
					addErrorMessage(
						error instanceof Error
							? error.message
							: "The conversation could not be loaded right now.",
					);
				});
		}

		function hydrateCurrentSession() {
			return loadSessionList()
				.then(function (sessions) {
					var activeSession = sessions.find(function (session) {
						return session.sessionId === state.sessionId;
					});

					if (activeSession) {
						return loadSessionDetail(activeSession.sessionId);
					}

					seedGreeting();
				})
				.catch(function (error) {
					seedGreeting();
					addErrorMessage(
						error instanceof Error
							? error.message
							: "The storefront assistant could not restore your conversations.",
					);
				});
		}

		/* ─── Cart integration ─── */

		function setCartButtonPending(button, pending) {
			button.disabled = pending;
			button.textContent = pending ? "Adding..." : "Add to cart";
		}

		function getCartUiTarget() {
			return document.querySelector("cart-drawer") || document.querySelector("cart-notification");
		}

		function getSectionInnerHTML(html, selector) {
			var documentFragment = new DOMParser().parseFromString(html, "text/html");
			var node = documentFragment.querySelector(selector || ".shopify-section");

			return node ? node.innerHTML : "";
		}

		function publishCartUpdate(productVariantId) {
			if (
				window.PUB_SUB_EVENTS &&
				window.PUB_SUB_EVENTS.cartUpdate &&
				typeof window.publish === "function"
			) {
				window.publish(window.PUB_SUB_EVENTS.cartUpdate, {
					productVariantId: productVariantId || null,
					source: "storefront-ai-widget",
				});
			}
		}

		function renderCartNotificationSummary(cart, response, addedCount) {
			var sections =
				typeof cart.getSectionsToRender === "function" ? cart.getSectionsToRender() : [];

			sections.forEach(function (section) {
				if (section.id === "cart-notification-product") {
					return;
				}

				var target = document.getElementById(section.id);
				var html = response.sections && response.sections[section.id];

				if (!target || typeof html !== "string") {
					return;
				}

				target.innerHTML = getSectionInnerHTML(html, section.selector);
			});

			var productContainer = document.getElementById("cart-notification-product");

			if (productContainer) {
				productContainer.innerHTML =
					'<div><h3 class="cart-notification-product__name h4">Added ' +
					String(addedCount) +
					" items to your cart</h3><p>Open your cart to review everything.</p></div>";
			}

			if (typeof cart.open === "function") {
				cart.open();
			}
		}

		function updateCartUiAfterAdd(response, addedItems, activeElement) {
			var cart = getCartUiTarget();
			var firstVariantId =
				addedItems && addedItems[0] && addedItems[0].variantId ? addedItems[0].variantId : null;

			if (!cart) {
				publishCartUpdate(firstVariantId);
				return;
			}

			if (typeof cart.setActiveElement === "function") {
				cart.setActiveElement(activeElement || document.activeElement);
			}

			if (
				cart.tagName &&
				cart.tagName.toLowerCase() === "cart-notification" &&
				addedItems.length > 1
			) {
				renderCartNotificationSummary(cart, response, addedItems.length);
				publishCartUpdate(firstVariantId);
				return;
			}

			if (typeof cart.renderContents === "function" && response && response.sections) {
				cart.renderContents(response);
			}

			publishCartUpdate(firstVariantId);
		}

		function checkoutCart() {
			// Use Shopify's native checkout mechanism: POST to /cart with name=checkout
			var checkoutForm = document.createElement("form");
			checkoutForm.method = "POST";
			checkoutForm.action = (window.routes && window.routes.cart_url) || "/cart";
			var checkoutInput = document.createElement("input");
			checkoutInput.type = "hidden";
			checkoutInput.name = "checkout";
			checkoutInput.value = "1";
			checkoutForm.appendChild(checkoutInput);
			document.body.appendChild(checkoutForm);
			checkoutForm.submit();
		}

		function applyCartPlan(plan, button) {
			if (state.applyingCart || !plan || !Array.isArray(plan.items) || plan.items.length === 0) {
				return Promise.resolve();
			}

			state.applyingCart = true;
			setCartButtonPending(button, true);

			var cart = getCartUiTarget();
			var payload = {
				items: plan.items.map(function (item) {
					return {
						id: item.variantId,
						quantity: item.quantity,
					};
				}),
				note: plan.note || undefined,
			};

			if (cart && typeof cart.getSectionsToRender === "function") {
				payload.sections = cart.getSectionsToRender().map(function (section) {
					return section.id;
				});
				payload.sections_url = window.location.pathname;
			}

			return fetchJson((window.routes && window.routes.cart_add_url) || "/cart/add.js", {
				body: JSON.stringify(payload),
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				method: "POST",
			})
				.then(function (response) {
					updateCartUiAfterAdd(response || {}, payload.items, button);
					addSystemMessage("Added the plan to your cart. Your cart has been updated.");
				})
				.catch(function (error) {
					addErrorMessage(
						error instanceof Error
							? error.message
							: "The cart plan could not be applied right now.",
					);
				})
				.finally(function () {
					state.applyingCart = false;
					setCartButtonPending(button, false);
				});
		}

		/* ─── Message helpers ─── */

		function addAssistantReply(reply) {
			setView("chat");
			appendMessageToFeed(
				createMessage(reply.tone === "refusal" ? "refusal" : "assistant", {
					cards: reply.cards || [],
					cartPlan: reply.cartPlan || null,
					onApplyCartPlan: applyCartPlan,
					onCheckoutCart: checkoutCart,
					references: reply.references || [],
					text: reply.answer || "",
				}),
			);
			renderSuggestions(reply.suggestedPrompts || []);
		}

		function addUserMessage(text) {
			setView("chat");
			appendMessageToFeed(
				createMessage("user", {
					cards: [],
					cartPlan: null,
					references: [],
					text: text,
				}),
			);
		}

		function addSystemMessage(text) {
			setView("chat");
			appendMessageToFeed(
				createMessage("system", {
					cards: [],
					cartPlan: null,
					references: [],
					text: text,
				}),
			);
		}

		function addErrorMessage(text) {
			setView("chat");
			appendMessageToFeed(
				createMessage("error", {
					cards: [],
					cartPlan: null,
					references: [],
					text: text,
				}),
			);
		}

		/* ─── Panel open / close with animation ─── */

		var panelAnimating = false;

		function openPanel() {
			if (!state.config || state.cartVisible || panelAnimating) {
				return;
			}

			setView("chat");
			state.open = true;
			panel.hidden = false;
			panel.style.display = "";
			toggle.setAttribute("aria-expanded", "true");
			toggle.setAttribute("aria-label", "Close store assistant");
			toggle.classList.add("storefront-ai-widget-toggle--open");

			panelAnimating = true;
			panel.classList.remove("storefront-ai-widget-panel--leaving");
			panel.classList.add("storefront-ai-widget-panel--entering");
			panel.addEventListener(
				"animationend",
				function () {
					panel.classList.remove("storefront-ai-widget-panel--entering");
					panelAnimating = false;
				},
				{ once: true },
			);

			if (state.loadedSessionId !== state.sessionId || feed.childNodes.length === 0) {
				void hydrateCurrentSession();
			} else {
				void loadSessionList();
			}

			window.setTimeout(function () {
				input.focus();
				scrollFeedToBottom();
			}, 0);

			enableFocusTrap();
		}

		function closePanel() {
			if (panelAnimating) {
				return;
			}

			state.open = false;
			toggle.setAttribute("aria-expanded", "false");
			toggle.setAttribute("aria-label", "Open store assistant");
			toggle.classList.remove("storefront-ai-widget-toggle--open");

			// Abort any in-flight stream
			abortActiveStream();

			// Close sessions drawer if open
			if (state.view === "sessions") {
				setView("chat");
			}

			panelAnimating = true;
			panel.classList.remove("storefront-ai-widget-panel--entering");
			panel.classList.add("storefront-ai-widget-panel--leaving");
			panel.addEventListener(
				"animationend",
				function () {
					panel.hidden = true;
					panel.style.display = "none";
					panel.classList.remove("storefront-ai-widget-panel--leaving");
					panelAnimating = false;
				},
				{ once: true },
			);

			disableFocusTrap();
			toggle.focus();
		}

		/* ─── Focus trap ─── */

		var focusTrapHandler = null;

		function enableFocusTrap() {
			focusTrapHandler = function (event) {
				if (event.key !== "Tab") {
					return;
				}

				var focusable = panel.querySelectorAll(
					'button:not([disabled]):not([hidden]), [href], textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
				);

				if (focusable.length === 0) {
					return;
				}

				var first = focusable[0];
				var last = focusable[focusable.length - 1];

				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			};

			panel.addEventListener("keydown", focusTrapHandler);
		}

		function disableFocusTrap() {
			if (focusTrapHandler) {
				panel.removeEventListener("keydown", focusTrapHandler);
				focusTrapHandler = null;
			}
		}

		/* ─── Escape key ─── */

		document.addEventListener("keydown", function (event) {
			if (event.key === "Escape" && state.open) {
				if (state.view === "sessions") {
					setView("chat");
					return;
				}
				closePanel();
			}
		});

		/* ─── Cart UI events ─── */

		document.addEventListener("storefront-cart-ui:toggle", function (event) {
			var detail = event && event.detail ? event.detail : null;
			setCartVisible(detail ? Boolean(detail.open) : isCartUiOpen());
		});

		/* ─── Send message ─── */

		var activeStream = null;

		function abortActiveStream() {
			if (activeStream && typeof activeStream.abort === "function") {
				activeStream.abort();
				activeStream = null;
			}
		}

		function sendMessage(messageText) {
			var trimmedMessage = (messageText || input.value || "").trim();

			if (!trimmedMessage || state.pending || !state.config) {
				return Promise.resolve();
			}

			if (trimmedMessage.length > 500) {
				trimmedMessage = trimmedMessage.slice(0, 500);
			}

			addUserMessage(trimmedMessage);
			input.value = "";
			syncInputHeight();
			syncSubmitVisibility();
			renderSuggestions([]);
			setPending(true);

			var streamingMessage = createStreamingAssistantMessage(applyCartPlan, checkoutCart);
			var streamedText = "";

			feed.appendChild(streamingMessage.element);
			scrollFeedToBottom();

			return ensureWidgetAuth()
				.then(function (token) {
					var stream = fetchEventStream(
						apiBase + "/api/shopify/widget/chat",
						{
							body: JSON.stringify({
								message: trimmedMessage,
								pageContext: pageContext,
								pageTitle: pageTitle,
								sessionId: state.sessionId,
								shopDomain: shopDomain,
							}),
							credentials: "include",
							headers: {
								Accept: "text/event-stream",
								Authorization: "Bearer " + token,
								"Content-Type": "application/json",
							},
							method: "POST",
						},
						{
							chunk: function (payload) {
								if (!payload || typeof payload.delta !== "string") {
									return;
								}

								streamedText += payload.delta;
								streamingMessage.setText(streamedText);
								scrollFeedToBottom();
							},
							done: function (reply) {
								activeStream = null;
								state.loadedSessionId = state.sessionId;
								var safeReply = reply || {};
								streamingMessage.replace(safeReply);
								renderSuggestions(
									Array.isArray(safeReply.suggestedPrompts) ? safeReply.suggestedPrompts : [],
								);
								scrollFeedToBottom();
								void loadSessionList();

								// Update ARIA live region
								if (safeReply.answer) {
									liveRegion.textContent = safeReply.answer;
								}
							},
							tool: function (payload) {
								if (!payload || typeof payload.toolName !== "string") {
									return;
								}

								streamingMessage.setToolStatus(getToolStatusText(payload.toolName));
								scrollFeedToBottom();
							},
							error: function (payload) {
								activeStream = null;
								streamingMessage.remove();
								addErrorMessage(
									payload && typeof payload.message === "string"
										? payload.message
										: "Something went wrong. Please try again.",
								);
							},
						},
					);

					activeStream = stream;
					return stream;
				})
				.catch(function (error) {
					activeStream = null;
					// Silently ignore abort errors
					if (error && error.name === "AbortError") {
						streamingMessage.remove();
						return;
					}
					streamingMessage.remove();
					addErrorMessage(
						error instanceof Error ? error.message : "Something went wrong. Please try again.",
					);
				})
				.finally(function () {
					setPending(false);
				});
		}

		/* ─── Event listeners ─── */

		toggle.addEventListener("click", function () {
			if (state.open) {
				closePanel();
				return;
			}
			openPanel();
		});

		closeButton.addEventListener("click", closePanel);

		chatsButton.addEventListener("click", function () {
			if (state.view === "sessions") {
				setView("chat");
				window.setTimeout(function () {
					input.focus();
				}, 0);
				return;
			}

			setView("sessions");
			void loadSessionList().catch(function (error) {
				setView("chat");
				addErrorMessage(
					error instanceof Error
						? error.message
						: "Your saved chats could not be loaded right now.",
				);
			});
		});

		newChatButton.addEventListener("click", startNewChat);
		sessionStartButton.addEventListener("click", startNewChat);

		sessionBackdrop.addEventListener("click", function () {
			setView("chat");
			window.setTimeout(function () {
				input.focus();
			}, 0);
		});

		input.addEventListener("keydown", function (event) {
			if (event.key !== "Enter" || event.isComposing) {
				return;
			}

			if (event.shiftKey || event.metaKey) {
				return;
			}

			event.preventDefault();
			void sendMessage();
		});

		form.addEventListener("submit", function (event) {
			event.preventDefault();
			void sendMessage();
		});

		/* ─── Initialize ─── */

		fetchJson(apiBase + "/api/shopify/widget?shop=" + encodeURIComponent(shopDomain))
			.then(function (rawConfig) {
				var config = rawConfig || {};
				config.greeting = config.greeting || "Hi! How can I help you today?";
				config.quickPrompts = Array.isArray(config.quickPrompts) ? config.quickPrompts : [];
				config.knowledgeSources = Array.isArray(config.knowledgeSources)
					? config.knowledgeSources
					: [];
				config.accentColor = config.accentColor || "#1a1a1a";
				config.position = config.position || "bottom-right";
				config.shopName = config.shopName || "";
				state.config = config;

				shell.classList.add(
					config.position === "bottom-left"
						? "storefront-ai-widget-shell--bottom-left"
						: "storefront-ai-widget-shell--bottom-right",
				);
				shell.style.setProperty("--storefront-ai-accent", config.accentColor || "#1a1a1a");

				if (!config.enabled) {
					if (isThemeEditor) {
						root.appendChild(
							buildThemeEditorNotice(
								"The app embed is installed, but the storefront concierge is disabled in merchant settings.",
							),
						);
					}
					return;
				}

				setCartVisible(isCartUiOpen());
				root.appendChild(shell);
			})
			.catch(function (error) {
				if (isThemeEditor) {
					root.appendChild(
						buildThemeEditorNotice(
							error instanceof Error
								? error.message
								: "The storefront assistant could not load its configuration.",
						),
					);
				}
			});
	}

	Array.prototype.forEach.call(
		document.querySelectorAll(".storefront-ai-embed-root"),
		bootstrapRoot,
	);
})();
