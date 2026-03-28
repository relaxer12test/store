import { Fragment } from "react";
import { Button } from "@/components/ui/cata/button";
import {
	DescriptionDetails,
	DescriptionList,
	DescriptionTerm,
} from "@/components/ui/cata/description-list";
import { Subheading } from "@/components/ui/cata/heading";
import { Text } from "@/components/ui/cata/text";
import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { CodeValue, getStatusTone } from "@/components/ui/resource";
import type { MerchantExplorerDetailData } from "@/shared/contracts/merchant-workspace";

function renderFieldValue(field: MerchantExplorerDetailData["fields"][number]) {
	if (field.tone === "status") {
		return <StatusPill tone={getStatusTone(field.value)}>{field.value ?? "n/a"}</StatusPill>;
	}

	if (field.tone === "code") {
		return <CodeValue value={field.value} />;
	}

	return field.value ?? "n/a";
}

export function MerchantExplorerDetailPage({
	backHref,
	data,
	description,
	errorMessage,
	isLoading,
	title,
}: {
	backHref: string;
	data: MerchantExplorerDetailData | null | undefined;
	description: string;
	errorMessage: string | null;
	isLoading: boolean;
	title: string;
}) {
	return (
		<div className="grid gap-4">
			<section className="rounded-lg border border-zinc-950/5 bg-white p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-zinc-900">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="min-w-0">
						<Button href={backHref} outline>
							Back to Explorer
						</Button>
						<Subheading className="mt-5 font-serif text-2xl">{data?.title ?? title}</Subheading>
						<Text className="mt-2 max-w-3xl">{data?.description ?? description}</Text>
						{data?.source ? (
							<div className="mt-3">
								<StatusPill tone="neutral">{data.source.label}</StatusPill>
							</div>
						) : null}
					</div>
				</div>
			</section>

			{isLoading ? (
				<div className="space-y-3 rounded-lg border border-zinc-950/5 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
					{Array.from({ length: 4 }, (_, index) => (
						<div
							className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
							key={index}
						/>
					))}
				</div>
			) : errorMessage ? (
				<EmptyState body={errorMessage} title="Explorer detail failed to load" />
			) : !data ? (
				<EmptyState body="The selected explorer row could not be loaded." title="Unavailable" />
			) : (
				<>
					<section className="rounded-lg border border-zinc-950/5 bg-white p-5 shadow-sm sm:p-6 dark:border-white/10 dark:bg-zinc-900">
						<DescriptionList>
							{data.fields.map((field) => (
								<Fragment key={field.label}>
									<DescriptionTerm>{field.label}</DescriptionTerm>
									<DescriptionDetails>{renderFieldValue(field)}</DescriptionDetails>
								</Fragment>
							))}
						</DescriptionList>
					</section>

					{data.sections.map((section) => (
						<Panel key={section.title} title={section.title}>
							{section.tone === "code" ? (
								<pre className="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-6 text-zinc-700 dark:text-zinc-300">
									{section.body}
								</pre>
							) : (
								<Text className="whitespace-pre-wrap">{section.body}</Text>
							)}
						</Panel>
					))}
				</>
			)}
		</div>
	);
}
