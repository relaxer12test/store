import { Config } from "@remotion/cli/config";
import path from "node:path";

Config.overrideWebpackConfig((currentConfiguration) => {
	return {
		...currentConfiguration,
		resolve: {
			...currentConfiguration.resolve,
			alias: {
				...(currentConfiguration.resolve?.alias as Record<string, string> | undefined),
				"@": path.resolve(process.cwd(), "src"),
			},
		},
	};
});
