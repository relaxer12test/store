import { createFileRoute } from "@tanstack/react-router";
import { LandingPage } from "@/features/marketing/components/landing-page";

export const Route = createFileRoute("/_app/")({ component: LandingRoute });

function LandingRoute() {
	return <LandingPage />;
}
