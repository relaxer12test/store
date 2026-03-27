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
		var item = createElement(
			"article",
			"storefront-ai-widget-card storefront-ai-widget-card--product",
		);
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

		item.appendChild(title);
		item.appendChild(summary);
		item.appendChild(meta);

		if (card.href) {
			var cta = createElement("a", "storefront-ai-widget-card-link", "View product");
			cta.href = card.href;
			cta.rel = "noopener noreferrer";
			cta.target = "_blank";
			item.appendChild(cta);
		}

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

	function createCartPlanCard(plan, onApply) {
		var card = createElement("section", "storefront-ai-widget-cart-plan");
		var title = createElement("h4", "storefront-ai-widget-card-title", "Cart plan");
		var list = createElement("ul", "storefront-ai-widget-cart-plan-list");
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
		card.appendChild(button);

		return card;
	}

	function createMessage(role, payload) {
		var item = createElement(
			"div",
			"storefront-ai-widget-message storefront-ai-widget-message--" + role,
		);
		var body = createElement("p", "storefront-ai-widget-message-text", payload.text);
		item.appendChild(body);

		if (Array.isArray(payload.cards) && payload.cards.length > 0) {
			var cards = createElement("div", "storefront-ai-widget-cards");

			payload.cards.forEach(function (card) {
				if (card && card.kind === "product") {
					cards.appendChild(createProductCard(card));
					return;
				}

				if (card && card.kind === "collection") {
					cards.appendChild(createCollectionCard(card));
				}
			});

			if (cards.childNodes.length > 0) {
				item.appendChild(cards);
			}
		}

		if (
			payload.cartPlan &&
			Array.isArray(payload.cartPlan.items) &&
			payload.cartPlan.items.length > 0
		) {
			item.appendChild(createCartPlanCard(payload.cartPlan, payload.onApplyCartPlan));
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
				return "Checking published products...";
			case "compareProducts":
				return "Comparing public product options...";
			case "searchCollections":
				return "Looking through collections...";
			case "answerPolicyQuestion":
				return "Checking the store policy details...";
			case "recommendBundle":
				return "Building a bundle idea...";
			case "buildCartPlan":
				return "Preparing a safe cart plan...";
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

	function bootstrapRoot(root) {
		if (!(root instanceof HTMLElement) || root.dataset.storefrontAiReady === "true") {
			return;
		}

		root.dataset.storefrontAiReady = "true";

		var apiBase = (root.dataset.apiBase || "").replace(/\/$/, "");
		var convexBase = (root.dataset.convexBase || apiBase || "").replace(/\/$/, "");
		var shopDomain = root.dataset.shopDomain || "";
		var isThemeEditor = root.dataset.themeEditor === "true";

		if (!apiBase || !convexBase || !shopDomain) {
			if (isThemeEditor) {
				root.appendChild(
					buildThemeEditorNotice("The app embed is missing its API base or shop domain."),
				);
			}

			return;
		}

		var state = {
			applyingCart: false,
			config: null,
			greetingLoaded: false,
			open: false,
			pending: false,
			sessionId: getSessionId(shopDomain),
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
		var close = createElement("button", "storefront-ai-widget-close", "x");
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

		input.placeholder = "What are you shopping for today?";
		input.rows = 4;
		input.maxLength = 500;

		submit.type = "submit";
		suggestions.hidden = true;

		header.appendChild(title);
		header.appendChild(close);
		toolbar.appendChild(helper);
		toolbar.appendChild(submit);
		form.appendChild(input);
		form.appendChild(toolbar);
		panel.appendChild(header);
		panel.appendChild(feed);
		panel.appendChild(suggestions);
		panel.appendChild(form);
		shell.appendChild(panel);
		shell.appendChild(toggle);

		function setPending(nextPending) {
			state.pending = nextPending;
			submit.disabled = nextPending;
			submit.textContent = nextPending ? "Sending..." : "Send";
		}

		function scrollFeedToBottom() {
			feed.scrollTop = feed.scrollHeight;
		}

		function renderSuggestions(promptSuggestions) {
			suggestions.innerHTML = "";

			if (!Array.isArray(promptSuggestions) || promptSuggestions.length === 0) {
				suggestions.hidden = true;
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

			suggestions.hidden = false;
		}

		function setCartButtonPending(button, pending) {
			button.disabled = pending;
			button.textContent = pending ? "Adding..." : "Add plan to cart";
		}

		function addAssistantReply(reply) {
			feed.appendChild(
				createMessage(reply.tone === "refusal" ? "refusal" : "assistant", {
					cards: reply.cards || [],
					cartPlan: reply.cartPlan || null,
					onApplyCartPlan: applyCartPlan,
					references: reply.references || [],
					text: reply.answer || "",
				}),
			);
			renderSuggestions(reply.suggestedPrompts || []);
			scrollFeedToBottom();
		}

		function addUserMessage(text) {
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

		function applyCartPlan(plan, button) {
			if (state.applyingCart || !plan || !Array.isArray(plan.items) || plan.items.length === 0) {
				return Promise.resolve();
			}

			state.applyingCart = true;
			setCartButtonPending(button, true);

			return fetchJson("/cart/add.js", {
				body: JSON.stringify({
					items: plan.items.map(function (item) {
						return {
							id: item.variantId,
							quantity: item.quantity,
						};
					}),
					note: plan.note || undefined,
				}),
				headers: {
					Accept: "application/json",
					"Content-Type": "application/json",
				},
				method: "POST",
			})
				.then(function () {
					addSystemMessage(
						"Added the plan to your cart. Shopify will calculate final pricing, taxes, and eligibility in the live cart.",
					);
				})
				.catch(function (error) {
					addSystemMessage(
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
			if (!state.config) {
				return;
			}

			state.open = true;
			panel.hidden = false;
			toggle.setAttribute("aria-expanded", "true");
			toggle.setAttribute("aria-label", "Close Moonbeam Unicorn Concierge");
			toggle.classList.add("storefront-ai-widget-toggle--open");
			panel.classList.add("storefront-ai-widget-panel--open");

			if (!state.greetingLoaded) {
				state.greetingLoaded = true;
				addAssistantReply({
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
				});
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

			return fetchEventStream(
				convexBase + "/shopify/widget/chat",
				{
					method: "POST",
					headers: {
						Accept: "text/event-stream",
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						message: trimmedMessage,
						pageTitle: document.title || undefined,
						sessionId: state.sessionId,
						shopDomain: shopDomain,
					}),
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
						streamingMessage.replace(reply || {});
						renderSuggestions((reply && reply.suggestedPrompts) || []);
						scrollFeedToBottom();
					},
					tool: function (payload) {
						if (!payload || typeof payload.toolName !== "string" || streamedText) {
							return;
						}

						streamingMessage.setText(getToolStatusText(payload.toolName));
						scrollFeedToBottom();
					},
				},
			)
				.catch(function (error) {
					streamingMessage.remove();
					addSystemMessage(
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

		form.addEventListener("submit", function (event) {
			event.preventDefault();
			void sendMessage();
		});

		fetchJson(convexBase + "/shopify/widget?shop=" + encodeURIComponent(shopDomain))
			.then(function (config) {
				state.config = config;
				heading.textContent = config.shopName || "Unicorn Concierge";
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
