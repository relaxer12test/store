import { createFileRoute } from "@tanstack/react-router";
import { InstallPage } from "@/features/marketing/components/install-page";

export const Route = createFileRoute("/install")({ component: InstallRoute });

function InstallRoute() {
	return <InstallPage />;
}
