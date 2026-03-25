import { createFileRoute } from "@tanstack/react-router";
import { MerchantSettingsPage } from "@/features/app-shell/components/merchant-settings-page";
import { merchantSettingsQuery, useMerchantSettings } from "@/features/app-shell/merchant-settings";
import {
	merchantKnowledgeDocumentsQuery,
	useMerchantKnowledgeDocuments,
} from "@/features/app-shell/merchant-workspace";
import { hasEmbeddedMerchantSession } from "@/shared/contracts/session";

export const Route = createFileRoute("/app/settings")({
	loader: async ({ context }) => {
		const session = await context.sessionApi.ensureEmbeddedSession();

		if (hasEmbeddedMerchantSession(session)) {
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

	return (
		<MerchantSettingsPage
			data={data}
			documents={documents}
			isRefreshing={isRefetching}
			onRefresh={() => void refetch()}
		/>
	);
}
