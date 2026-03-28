import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/app/")({
	beforeLoad: async () => {
		throw redirect({
			to: "/app/overview",
		});
	},
});
