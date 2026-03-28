import { createFileRoute } from "@tanstack/react-router";
import { MerchantSettingsPage } from "@/features/app-shell/components/merchant-settings-page";
import { merchantSettingsQuery, useMerchantSettings } from "@/features/app-shell/merchant-settings";
import {
	merchantKnowledgeDocumentsQuery,
	useMerchantKnowledgeDocuments,
} from "@/features/app-shell/merchant-workspace";

export const Route = createFileRoute("/_app/app/settings")({
	loader: async ({ context }) => {
		await Promise.all([
			context.preload.ensureQueryData(merchantSettingsQuery),
			context.preload.ensureQueryData(merchantKnowledgeDocumentsQuery),
		]);
	},
	component: MerchantSettingsRoute,
});

function MerchantSettingsRoute() {
	const { data } = useMerchantSettings();
	const { data: documents } = useMerchantKnowledgeDocuments();

	return <MerchantSettingsPage data={data} documents={documents} />;
}
