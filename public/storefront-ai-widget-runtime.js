(function () {
	var SESSION_KEY_PREFIX = "storefront-ai-session::";

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
		return fetch(url, options).then(function (response) {
			if (!response.ok) {
				return response.text().then(function (text) {
					var data = null;

					try {
						data = text ? JSON.parse(text) : null;
					} catch {}

					var message =
						data && typeof data.error === "string"
							? data.error
							: "The storefront assistant could not respond.";
					throw new Error(message);
				});
			}

			if (!response.body) {
				throw new Error("The storefront assistant did not return a stream.");
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
	}

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
				media = createElement("a", "storefront-ai-widget-card-media");
				media.href = card.href;
				media.rel = "noopener noreferrer";
				media.target = "_blank";
			} else {
				media = createElement("div", "storefront-ai-widget-card-media");
			}

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

		var button = createElement("button", "storefront-ai-widget-apply-cart", "Add plan to cart");
		button.type = "button";
		button.addEventListener("click", function () {
			onApply(plan, button);
		});
		actions.appendChild(button);

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

	function createStreamingAssistantMessage(onApplyCartPlan) {
		var current = createMessage("assistant", {
			cards: [],
			cartPlan: null,
			onApplyCartPlan: onApplyCartPlan,
			onCheckoutCart: checkoutCart,
			references: [],
			text: "Working on it...",
		});
		var body = current.querySelector(".storefront-ai-widget-message-text");
		current.classList.add("storefront-ai-widget-message--streaming");

		function setText(text) {
			if (!body) {
				return;
			}

			body.textContent = text || "";
		}

		function replace(reply) {
			var next = createMessage(reply.tone === "refusal" ? "refusal" : "assistant", {
				cards: reply.cards || [],
				cartPlan: reply.cartPlan || null,
				onApplyCartPlan: onApplyCartPlan,
				onCheckoutCart: checkoutCart,
				references: reply.references || [],
				text: reply.answer || "",
			});

			if (current.parentNode) {
				current.parentNode.replaceChild(next, current);
			}

			current = next;
			body = current.querySelector(".storefront-ai-widget-message-text");
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
		};
	}

	function getToolStatusText(toolName) {
		switch (toolName) {
			case "searchCatalog":
			case "getProductDetail":
				return "Looking for a few good matches...";
			case "compareProducts":
				return "Comparing a few options...";
			case "searchCollections":
				return "Looking through collections...";
			case "answerPolicyQuestion":
				return "Checking the store details...";
			case "recommendBundle":
				return "Putting together a bundle...";
			case "buildCartPlan":
				return "Getting the cart ready...";
			default:
				return "Working on it...";
		}
	}

	function buildThemeEditorNotice(message) {
		var notice = createElement("div", "storefront-ai-widget-theme-note");
		var title = createElement("strong", "", "Storefront AI embed");
		var body = createElement("p", "", message);
		notice.appendChild(title);
		notice.appendChild(body);
		return notice;
	}

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

	function bootstrapRoot(root) {
		if (!(root instanceof HTMLElement) || root.dataset.storefrontAiReady === "true") {
			return;
		}

		root.dataset.storefrontAiReady = "true";

		var apiBase = (root.dataset.apiBase || "").replace(/\/$/, "");
		var shopDomain = root.dataset.shopDomain || "";
		var isThemeEditor = root.dataset.themeEditor === "true";

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

		var shell = createElement("section", "storefront-ai-widget-shell");
		var toggle = createElement("button", "storefront-ai-widget-toggle");
		var toggleIcon = document.createElement("span");
		toggleIcon.className = "storefront-ai-widget-toggle-icon";
		toggleIcon.innerHTML =
			'<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" class="storefront-ai-widget-unicorn-svg"><g class="storefront-ai-widget-unicorn-body"><path d="M14 28c0-8 5-14 12-14 3 0 5 1 6 3l1-3s1-5-3-8l-2-2s-1 3-2 4c-2-2-5-3-8-2-4 1-7 5-8 10s-1 9 2 12z" fill="currentColor" opacity="0.9"/><path d="M29 4l-2-4-1 5z" fill="#F0D5A8"/><circle cx="23" cy="11" r="1.2" fill="white" opacity="0.9"/><path d="M16 26l-1 6m3-5l0 5m4-5l1 5m3-6l1 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/><path d="M14 23c-4-2-6 1-5 4" stroke="#F4C2C2" stroke-width="1.5" stroke-linecap="round" fill="none" class="storefront-ai-widget-unicorn-tail"/></g><path d="M6 10l1 2.5 3 0-2 2 1 3-3-2-3 2 1-3-2-2 3 0z" fill="#F0D5A8" opacity="0.5" class="storefront-ai-widget-unicorn-star storefront-ai-widget-unicorn-star--1"/><path d="M33 8l.6 1.5 1.8 0-1.2 1.2.5 1.8-1.7-1.2-1.7 1.2.5-1.8-1.2-1.2 1.8 0z" fill="#F0D5A8" opacity="0.4" class="storefront-ai-widget-unicorn-star storefront-ai-widget-unicorn-star--2"/><circle cx="35" cy="18" r="1" fill="#C8A2C8" opacity="0.4" class="storefront-ai-widget-unicorn-sparkle storefront-ai-widget-unicorn-sparkle--1"/><circle cx="8" cy="22" r="0.8" fill="#F4C2C2" opacity="0.5" class="storefront-ai-widget-unicorn-sparkle storefront-ai-widget-unicorn-sparkle--2"/><circle cx="32" cy="28" r="0.6" fill="#B2DFDB" opacity="0.4" class="storefront-ai-widget-unicorn-sparkle storefront-ai-widget-unicorn-sparkle--3"/></svg>';
		var panel = createElement("div", "storefront-ai-widget-panel");
		var header = createElement("div", "storefront-ai-widget-header");
		var title = createElement("div", "storefront-ai-widget-title");
		var eyebrow = createElement("span", "storefront-ai-widget-eyebrow", "Moonbeam");
		var heading = createElement("span", "storefront-ai-widget-heading", "Unicorn Concierge");
		var headerActions = createElement("div", "storefront-ai-widget-header-actions");
		var chatsButton = createElement(
			"button",
			"storefront-ai-widget-header-button storefront-ai-widget-header-button--secondary",
			"Chats",
		);
		var newChatButton = createElement("button", "storefront-ai-widget-header-button", "New chat");
		var close = createElement("button", "storefront-ai-widget-close", "x");
		var sessionPage = createElement("div", "storefront-ai-widget-session-page");
		var sessionIntro = createElement("div", "storefront-ai-widget-session-intro");
		var sessionKicker = createElement("p", "storefront-ai-widget-session-kicker", "Chats");
		var sessionHeading = createElement(
			"h3",
			"storefront-ai-widget-session-heading",
			"Pick up where you left off",
		);
		var sessionCopy = createElement(
			"p",
			"storefront-ai-widget-session-copy",
			"Open an earlier chat or start a new one. Fresh chats appear here after the first answer.",
		);
		var sessionStartButton = createElement(
			"button",
			"storefront-ai-widget-session-cta",
			"Start a new chat",
		);
		var sessionListView = createElement("div", "storefront-ai-widget-session-list");
		var feed = createElement("div", "storefront-ai-widget-feed");
		var suggestions = createElement("div", "storefront-ai-widget-suggestions");
		var form = createElement("form", "storefront-ai-widget-form");
		var input = createElement("textarea", "storefront-ai-widget-input");
		var toolbar = createElement("div", "storefront-ai-widget-toolbar");
		var helper = createElement(
			"p",
			"storefront-ai-widget-helper",
			"Ask about products, gifts, party planning, sizing, or shipping.",
		);
		var submit = createElement("button", "storefront-ai-widget-submit", "Send");

		toggle.type = "button";
		toggle.setAttribute("aria-expanded", "false");
		toggle.setAttribute("aria-label", "Ask Moonbeam Unicorn Concierge");
		toggle.appendChild(toggleIcon);

		panel.hidden = true;
		panel.setAttribute("role", "dialog");
		panel.setAttribute("aria-label", "Moonbeam Unicorn Concierge");

		title.appendChild(eyebrow);
		title.appendChild(heading);

		close.type = "button";
		close.setAttribute("aria-label", "Close storefront AI assistant");
		chatsButton.type = "button";
		chatsButton.setAttribute("aria-label", "Open saved chats");
		newChatButton.type = "button";
		newChatButton.setAttribute("aria-label", "Start a new chat");
		sessionStartButton.type = "button";

		input.placeholder = "What are you shopping for today?";
		input.rows = 4;
		input.maxLength = 500;

		submit.type = "submit";
		sessionPage.hidden = true;
		suggestions.hidden = true;

		header.appendChild(title);
		headerActions.appendChild(chatsButton);
		headerActions.appendChild(newChatButton);
		headerActions.appendChild(close);
		header.appendChild(headerActions);
		sessionIntro.appendChild(sessionKicker);
		sessionIntro.appendChild(sessionHeading);
		sessionIntro.appendChild(sessionCopy);
		sessionIntro.appendChild(sessionStartButton);
		sessionPage.appendChild(sessionIntro);
		sessionPage.appendChild(sessionListView);
		toolbar.appendChild(helper);
		toolbar.appendChild(submit);
		form.appendChild(input);
		form.appendChild(toolbar);
		panel.appendChild(header);
		panel.appendChild(sessionPage);
		panel.appendChild(feed);
		panel.appendChild(suggestions);
		panel.appendChild(form);
		shell.appendChild(panel);
		shell.appendChild(toggle);

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

			if (nextCartVisible && state.open) {
				closePanel();
			}

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

		function setPending(nextPending) {
			state.pending = nextPending;
			submit.disabled = nextPending;
			submit.textContent = nextPending ? "Sending..." : "Send";
		}

		function syncPanelView() {
			var showingSessions = state.view === "sessions";

			sessionPage.hidden = !showingSessions;
			feed.hidden = showingSessions;
			form.hidden = showingSessions;
			suggestions.hidden = showingSessions || state.suggestionCount === 0;
			chatsButton.textContent = showingSessions ? "Back to chat" : "Chats";
			chatsButton.setAttribute(
				"aria-label",
				showingSessions ? "Return to the current chat" : "Open saved chats",
			);
		}

		function setView(nextView) {
			state.view = nextView === "sessions" ? "sessions" : "chat";
			syncPanelView();
		}

		function scrollFeedToBottom() {
			feed.scrollTop = feed.scrollHeight;
		}

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
					void sendMessage(promptText);
				});
				suggestions.appendChild(suggestion);
			});

			suggestions.hidden = state.view === "sessions";
		}

		function clearFeed() {
			feed.innerHTML = "";
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
					createElement(
						"p",
						"",
						"Start a new chat and it will appear here after the first answer.",
					),
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

		function ensureWidgetAuth() {
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
						throw new Error("The storefront assistant could not establish an anonymous session.");
					}

					state.authToken = payload.token;
					return payload.token;
				})
				.finally(function () {
					state.authPromise = null;
				});

			return state.authPromise;
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
				});
			});
		}

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

		function setCartButtonPending(button, pending) {
			button.disabled = pending;
			button.textContent = pending ? "Adding..." : "Add plan to cart";
		}

		function addAssistantReply(reply) {
			setView("chat");
			feed.appendChild(
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
			scrollFeedToBottom();
		}

		function addUserMessage(text) {
			setView("chat");
			feed.appendChild(
				createMessage("user", {
					cards: [],
					cartPlan: null,
					references: [],
					text: text,
				}),
			);
			scrollFeedToBottom();
		}

		function addSystemMessage(text) {
			setView("chat");
			feed.appendChild(
				createMessage("system", {
					cards: [],
					cartPlan: null,
					references: [],
					text: text,
				}),
			);
			scrollFeedToBottom();
		}

		function addErrorMessage(text) {
			setView("chat");
			feed.appendChild(
				createMessage("error", {
					cards: [],
					cartPlan: null,
					references: [],
					text: text,
				}),
			);
			scrollFeedToBottom();
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
			window.location.assign("/checkout");
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

		function openPanel() {
			if (!state.config || state.cartVisible) {
				return;
			}

			setView("chat");
			state.open = true;
			panel.hidden = false;
			toggle.setAttribute("aria-expanded", "true");
			toggle.setAttribute("aria-label", "Close Moonbeam Unicorn Concierge");
			toggle.classList.add("storefront-ai-widget-toggle--open");
			panel.classList.add("storefront-ai-widget-panel--open");

			if (state.loadedSessionId !== state.sessionId || feed.childNodes.length === 0) {
				void hydrateCurrentSession();
			} else {
				void loadSessionList();
			}

			window.setTimeout(function () {
				input.focus();
				scrollFeedToBottom();
			}, 0);
		}

		function closePanel() {
			state.open = false;
			panel.hidden = true;
			toggle.setAttribute("aria-expanded", "false");
			toggle.setAttribute("aria-label", "Ask Moonbeam Unicorn Concierge");
			toggle.classList.remove("storefront-ai-widget-toggle--open");
			panel.classList.remove("storefront-ai-widget-panel--open");
		}

		document.addEventListener("storefront-cart-ui:toggle", function (event) {
			var detail = event && event.detail ? event.detail : null;
			setCartVisible(detail ? Boolean(detail.open) : isCartUiOpen());
		});

		function sendMessage(messageText) {
			var trimmedMessage = (messageText || input.value || "").trim();

			if (!trimmedMessage || state.pending || !state.config) {
				return Promise.resolve();
			}

			addUserMessage(trimmedMessage);
			input.value = "";
			renderSuggestions([]);
			setPending(true);
			var streamingMessage = createStreamingAssistantMessage(applyCartPlan);
			var streamedText = "";

			feed.appendChild(streamingMessage.element);
			scrollFeedToBottom();

			return ensureWidgetAuth()
				.then(function (token) {
					return fetchEventStream(
						apiBase + "/api/shopify/widget/chat",
						{
							body: JSON.stringify({
								message: trimmedMessage,
								pageTitle: document.title || undefined,
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
								state.loadedSessionId = state.sessionId;
								streamingMessage.replace(reply || {});
								renderSuggestions((reply && reply.suggestedPrompts) || []);
								scrollFeedToBottom();
								void loadSessionList();
							},
							tool: function (payload) {
								if (!payload || typeof payload.toolName !== "string" || streamedText) {
									return;
								}

								streamingMessage.setText(getToolStatusText(payload.toolName));
								scrollFeedToBottom();
							},
						},
					);
				})
				.catch(function (error) {
					streamingMessage.remove();
					addErrorMessage(
						error instanceof Error ? error.message : "The storefront assistant could not respond.",
					);
				})
				.finally(function () {
					setPending(false);
				});
		}

		toggle.addEventListener("click", function () {
			if (state.open) {
				closePanel();
				return;
			}

			openPanel();
		});

		close.addEventListener("click", closePanel);
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

		fetchJson(apiBase + "/api/shopify/widget?shop=" + encodeURIComponent(shopDomain))
			.then(function (config) {
				state.config = config;
				heading.textContent = "Unicorn Concierge";
				helper.textContent = config.enabled
					? "Ask about products, gifts, party planning, sizing, or shipping."
					: "Enable the widget in merchant settings before shoppers can use it.";

				shell.classList.add(
					config.position === "bottom-left"
						? "storefront-ai-widget-shell--bottom-left"
						: "storefront-ai-widget-shell--bottom-right",
				);
				shell.style.setProperty("--storefront-ai-accent", config.accentColor || "#0f172a");

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
