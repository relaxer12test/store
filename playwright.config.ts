import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filePath: string) {
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

loadEnvFile(resolve(process.cwd(), ".env.local"));

export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	outputDir: "test-results/playwright-artifacts",
	reporter: [["list"]],
	retries: 0,
	testMatch: /.*\.spec\.ts/,
	timeout: 30_000,
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		video: "retain-on-failure",
	},
	workers: 1,
	projects: [
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
			},
		},
	],
});
