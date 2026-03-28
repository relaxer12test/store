import type React from "react";
import { Subheading } from "@/components/ui/cata/heading";
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
		<div className="grid gap-2">
			<div className="flex items-center justify-between gap-3 px-0.5">
				<div className="flex items-center gap-3">
					<Subheading>{title}</Subheading>
					<Text className="hidden text-xs/5 sm:block">{description}</Text>
				</div>
				{badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
			</div>

			{detail ? (
				<div className="grid gap-2 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
					<div className="grid min-w-0 gap-2">{children}</div>
					<div className="min-w-0 xl:sticky xl:top-6 xl:self-start">{detail}</div>
				</div>
			) : (
				<div className="grid min-w-0 gap-2">{children}</div>
			)}
		</div>
	);
}
