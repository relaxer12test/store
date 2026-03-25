(function () {
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

	function createMessage(role, text, references) {
		var item = createElement(
			"div",
			"storefront-ai-widget-message storefront-ai-widget-message--" + role,
		);
		var body = createElement("p", "", text);
		item.appendChild(body);

		if (Array.isArray(references) && references.length > 0) {
			var referenceRow = createElement("div", "storefront-ai-widget-references");

			references.forEach(function (reference) {
				referenceRow.appendChild(
					createElement("span", "storefront-ai-widget-reference", reference),
				);
			});

			item.appendChild(referenceRow);
		}

		return item;
	}

	function buildThemeEditorNotice(message) {
		var notice = createElement("div", "storefront-ai-widget-theme-note");
		var title = createElement("strong", "", "Storefront AI embed");
		var body = createElement("p", "", message);
		notice.appendChild(title);
		notice.appendChild(body);
		return notice;
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
					buildThemeEditorNotice("The app embed is missing its API base or shop domain."),
				);
			}

			return;
		}

		var state = {
			config: null,
			greetingLoaded: false,
			open: false,
			pending: false,
		};

		var shell = createElement("section", "storefront-ai-widget-shell");
		var toggle = createElement("button", "storefront-ai-widget-toggle");
		var toggleDot = createElement("span", "storefront-ai-widget-toggle-dot");
		var toggleText = createElement("span", "", "Ask AI");
		var panel = createElement("div", "storefront-ai-widget-panel");
		var header = createElement("div", "storefront-ai-widget-header");
		var title = createElement("div", "storefront-ai-widget-title");
		var eyebrow = createElement("span", "storefront-ai-widget-eyebrow", "Storefront AI");
		var heading = createElement("span", "storefront-ai-widget-heading", "Store assistant");
		var close = createElement("button", "storefront-ai-widget-close", "x");
		var feed = createElement("div", "storefront-ai-widget-feed");
		var suggestions = createElement("div", "storefront-ai-widget-suggestions");
		var form = createElement("form", "storefront-ai-widget-form");
		var input = createElement("textarea", "storefront-ai-widget-input");
		var toolbar = createElement("div", "storefront-ai-widget-toolbar");
		var helper = createElement(
			"p",
			"storefront-ai-widget-helper",
			"Ask about products, shipping, returns, or what to compare before ordering.",
		);
		var submit = createElement("button", "storefront-ai-widget-submit", "Send");

		toggle.type = "button";
		toggle.setAttribute("aria-expanded", "false");
		toggle.setAttribute("aria-label", "Open storefront AI assistant");
		toggle.appendChild(toggleDot);
		toggle.appendChild(toggleText);

		panel.hidden = true;
		panel.setAttribute("role", "dialog");
		panel.setAttribute("aria-label", "Storefront AI assistant");

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

		function addAssistantMessage(text, references, promptSuggestions) {
			feed.appendChild(createMessage("assistant", text, references));
			suggestions.innerHTML = "";

			if (Array.isArray(promptSuggestions) && promptSuggestions.length > 0) {
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
			} else {
				suggestions.hidden = true;
			}

			scrollFeedToBottom();
		}

		function addUserMessage(text) {
			feed.appendChild(createMessage("user", text));
			scrollFeedToBottom();
		}

		function addSystemMessage(text) {
			feed.appendChild(createMessage("system", text));
			scrollFeedToBottom();
		}

		function openPanel() {
			if (!state.config) {
				return;
			}

			state.open = true;
			panel.hidden = false;
			toggle.setAttribute("aria-expanded", "true");
			toggleText.textContent = "Close AI";

			if (!state.greetingLoaded) {
				state.greetingLoaded = true;
				addAssistantMessage(state.config.greeting, state.config.knowledgeSources.slice(0, 3), [
					"What should I know before ordering?",
					"Can you help me choose a product?",
					"Where can I find shipping details?",
				]);
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
			toggleText.textContent = "Ask AI";
		}

		function sendMessage(messageText) {
			var trimmedMessage = (messageText || input.value || "").trim();

			if (!trimmedMessage || state.pending || !state.config) {
				return Promise.resolve();
			}

			addUserMessage(trimmedMessage);
			input.value = "";
			suggestions.hidden = true;
			suggestions.innerHTML = "";
			setPending(true);

			return fetchJson(apiBase + "/api/shopify/widget/chat", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					message: trimmedMessage,
					pageTitle: document.title || undefined,
					shopDomain: shopDomain,
				}),
			})
				.then(function (reply) {
					addAssistantMessage(reply.answer, reply.references || [], reply.suggestedPrompts || []);
				})
				.catch(function (error) {
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

		fetchJson(apiBase + "/api/shopify/widget?shop=" + encodeURIComponent(shopDomain))
			.then(function (config) {
				state.config = config;
				heading.textContent = config.shopName || "Store assistant";
				helper.textContent = config.enabled
					? "Ask about products, shipping, returns, or what to compare before ordering."
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
								"The app embed is installed, but the storefront widget is disabled in merchant settings.",
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
