import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/internal/")({
	beforeLoad: async () => {
		throw redirect({
			to: "/internal/overview",
		});
	},
});
