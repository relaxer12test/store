import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

const toolIgnorePatterns = [
	".agents/**",
	".claude/**",
	".cta.json",
	"README.md",
	"dist/**",
	"plans/**",
	"initial.md",
	"skills-lock.json",
	"src/components/ui/cata/**",
	"src/**/*.gen.ts",
	"src/**/*.gen.tsx",
	"src/**/routeTree.gen.ts",
	"convex/_generated/**",
];

const isVitest = process.env.VITEST === "true" || process.env.NODE_ENV === "test";

const config = defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	plugins: [
		devtools(),
		...(!isVitest ? [cloudflare({ viteEnvironment: { name: "ssr" } })] : []),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
	test: {
		include: ["src/**/*.test.ts", "src/**/*.test.tsx", "convex/**/*.test.ts"],
		passWithNoTests: true,
	},
	lint: {
		ignorePatterns: toolIgnorePatterns,
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
	fmt: {
		ignorePatterns: toolIgnorePatterns,
		singleQuote: false,
		sortImports: {
			newlinesBetween: false,
			groups: [
				["value-builtin", "value-external", "type-import"],
				["value-internal", "type-internal"],
				[
					"value-parent",
					"value-sibling",
					"value-index",
					"type-parent",
					"type-sibling",
					"type-index",
				],
				"unknown",
			],
		},
		useTabs: true,
	},
});

export default config;
