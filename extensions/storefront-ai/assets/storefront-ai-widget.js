(function () {
	var root = document.querySelector(".storefront-ai-embed-root");

	if (!(root instanceof HTMLElement)) {
		return;
	}

	var apiBase = (root.getAttribute("data-api-base") || "").replace(/\/$/, "");

	if (!apiBase || document.querySelector('script[data-storefront-ai-runtime="true"]')) {
		return;
	}

	var script = document.createElement("script");
	script.defer = true;
	script.src = apiBase + "/storefront-ai-widget-runtime.js";
	script.dataset.storefrontAiRuntime = "true";
	document.head.appendChild(script);
})();
