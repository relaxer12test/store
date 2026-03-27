import { createFileRoute } from "@tanstack/react-router";
import { MerchantSettingsPage } from "@/features/app-shell/components/merchant-settings-page";
import { merchantSettingsQuery, useMerchantSettings } from "@/features/app-shell/merchant-settings";
import {
	merchantKnowledgeDocumentsQuery,
	useMerchantKnowledgeDocuments,
} from "@/features/app-shell/merchant-workspace";
import { hasMerchantViewer } from "@/shared/contracts/auth";

export const Route = createFileRoute("/_chrome/app/settings")({
	loader: async ({ context }) => {
		const viewer = await context.auth.ensureEmbeddedViewer();

		if (hasMerchantViewer(viewer)) {
			await Promise.all([
				context.preload.ensureQueryData(merchantSettingsQuery),
				context.preload.ensureQueryData(merchantKnowledgeDocumentsQuery),
			]);
		}
	},
	component: MerchantSettingsRoute,
});

function MerchantSettingsRoute() {
	const { data, isRefetching, refetch } = useMerchantSettings();
	const { data: documents } = useMerchantKnowledgeDocuments();
	const settingsKey = JSON.stringify({
		documentsGeneratedAt: documents.generatedAt,
		widgetSettings: data.widgetSettings,
	});

	return (
		<MerchantSettingsPage
			key={settingsKey}
			data={data}
			documents={documents}
			isRefreshing={isRefetching}
			onRefresh={() => void refetch()}
		/>
	);
}
