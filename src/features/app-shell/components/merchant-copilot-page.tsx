import { AiThreadShell } from "@/components/ui/ai";
import { MerchantModulePage } from "@/features/app-shell/components/merchant-module-page";
import type { ModuleSnapshot } from "@/shared/contracts/app-shell";

export function MerchantCopilotPage({ snapshot }: { snapshot: ModuleSnapshot }) {
	return (
		<div className="grid gap-5">
			<AiThreadShell messages={snapshot.messages ?? []} title={snapshot.title} />
			<MerchantModulePage snapshot={snapshot} />
		</div>
	);
}
