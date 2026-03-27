import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function readEnvFile() {
	const envPath = resolve(process.cwd(), ".env.local");

	try {
		const file = readFileSync(envPath, "utf8");
		const values = {};

		for (const line of file.split(/\r?\n/)) {
			const trimmed = line.trim();

			if (!trimmed || trimmed.startsWith("#")) {
				continue;
			}

			const separatorIndex = trimmed.indexOf("=");

			if (separatorIndex < 1) {
				continue;
			}

			const name = trimmed.slice(0, separatorIndex).trim();
			const rawValue = trimmed.slice(separatorIndex + 1).trim();
			const value = rawValue.replace(/\s+#.*$/, "").replace(/^['"]|['"]$/g, "");

			values[name] = value;
		}

		return values;
	} catch {
		return {};
	}
}

const envFile = readEnvFile();

function getEnv(name) {
	return process.env[name]?.trim() || envFile[name]?.trim() || "";
}

function getRequiredEnv(name) {
	const value = getEnv(name);

	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}

	return value;
}

function renderThemeSettingsData({ applicationUrl, cwd }) {
	const settingsDataPath = resolve(cwd, "theme/config/settings_data.json");
	const source = readFileSync(settingsDataPath, "utf8");
	const jsonStartIndex = source.indexOf("{");

	if (jsonStartIndex < 0) {
		throw new Error("theme/config/settings_data.json does not contain a JSON object.");
	}

	const prefix = source.slice(0, jsonStartIndex);
	const settingsData = JSON.parse(source.slice(jsonStartIndex));

	settingsData.current ??= {};
	settingsData.current.storefront_ai_app_base_url = applicationUrl;
	delete settingsData.current.storefront_ai_convex_base_url;
	settingsData.current.blocks ??= {};

	for (const block of Object.values(settingsData.current.blocks)) {
		if (
			!block ||
			typeof block !== "object" ||
			typeof block.type !== "string" ||
			!block.type.includes("/blocks/storefront-ai-embed/")
		) {
			continue;
		}

		block.settings ??= {};
		block.settings.app_base_url = applicationUrl;
		delete block.settings.convex_base_url;
	}

	writeFileSync(settingsDataPath, `${prefix}${JSON.stringify(settingsData, null, "\t")}\n`);
}

const cwd = process.cwd();
const sourcePath = resolve(cwd, "shopify.app.toml");
const targetPath = resolve(cwd, "shopify.app.deploy.toml");
const applicationUrl = getRequiredEnv("SHOPIFY_APP_URL");
const webhookUri = `${applicationUrl}/api/shopify/webhooks`;

const template = readFileSync(sourcePath, "utf8");
const rendered = template
	.replace(/^application_url = .+$/m, `application_url = "${applicationUrl}"`)
	.replace(/^uri = .+$/m, `uri = "${webhookUri}"`);

writeFileSync(targetPath, rendered);
renderThemeSettingsData({
	applicationUrl,
	cwd,
});
