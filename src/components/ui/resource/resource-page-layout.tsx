import type React from "react";
import { Heading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";

export function ResourcePageLayout({
	badges,
	children,
	description,
	detail,
	title,
}: React.PropsWithChildren<{
	badges?: React.ReactNode;
	description: string;
	detail?: React.ReactNode;
	title: string;
}>) {
	return (
		<div className="grid gap-5">
			<header className="flex flex-col gap-4 rounded-[2rem] border border-zinc-950/6 bg-white px-6 py-6 shadow-sm dark:border-white/10 dark:bg-zinc-900">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
					<div className="max-w-3xl">
						<Heading>{title}</Heading>
						<Text className="mt-2">{description}</Text>
					</div>
					{badges ? <div className="flex flex-wrap items-center gap-2">{badges}</div> : null}
				</div>
			</header>

			{detail ? (
				<div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
					<div className="min-w-0">{children}</div>
					<div className="min-w-0 xl:sticky xl:top-6 xl:self-start">{detail}</div>
				</div>
			) : (
				<div className="min-w-0">{children}</div>
			)}
		</div>
	);
}
