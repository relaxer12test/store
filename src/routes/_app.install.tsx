import { createFileRoute } from "@tanstack/react-router";
import { InstallPage } from "@/features/marketing/components/install-page";

export const Route = createFileRoute("/_app/install")({ component: InstallRoute });

function InstallRoute() {
	return <InstallPage />;
}
