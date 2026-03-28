import { useConvexAction, useConvexMutation } from "@convex-dev/react-query";
import type { Id } from "@convex/_generated/dataModel";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { Button } from "@/components/ui/cata/button";
import { Checkbox, CheckboxField } from "@/components/ui/cata/checkbox";
import { Description, Field, FieldGroup, Fieldset, Label } from "@/components/ui/cata/fieldset";
import { Subheading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Select } from "@/components/ui/cata/select";
import { Text } from "@/components/ui/cata/text";
import { Textarea } from "@/components/ui/cata/textarea";
import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { DetailRow, Panel } from "@/components/ui/layout";
import { merchantSettingsQuery } from "@/features/app-shell/merchant-settings";
import {
	invalidateMerchantWorkspaceQueries,
	merchantKnowledgeDocumentsQuery,
} from "@/features/app-shell/merchant-workspace";
import { api } from "@/lib/convex-api";
import type {
	MerchantSettingsData,
	ThemeAppEmbedStatus,
} from "@/shared/contracts/merchant-settings";
import type { MerchantKnowledgeDocumentsData } from "@/shared/contracts/merchant-workspace";

function embedStatusTone(status: ThemeAppEmbedStatus) {
	switch (status) {
		case "enabled":
			return "success";
		case "disabled":
			return "watch";
		case "not_detected":
			return "blocked";
		case "unavailable":
			return "neutral";
	}
}

function installStatusTone(status: MerchantSettingsData["installHealth"]["installStatus"]) {
	return status === "connected" ? "success" : status === "pending" ? "watch" : "blocked";
}

function statusTone(status: string) {
	if (status === "connected" || status === "success") {
		return "success";
	}

	if (status === "pending") {
		return "watch";
	}

	if (status === "inactive" || status === "missing") {
		return "blocked";
	}

	return "neutral";
}

function cacheStatusTone(status: string) {
	if (status === "ready") {
		return "success";
	}

	if (status === "pending" || status === "running") {
		return "watch";
	}

	if (status === "error") {
		return "blocked";
	}

	return "neutral";
}

function knowledgeSourcesToText(knowledgeSources: string[]) {
	return knowledgeSources.join("\n");
}

function textToKnowledgeSources(value: string) {
	return value
		.split("\n")
		.map((source) => source.trim())
		.filter(Boolean);
}

export function MerchantSettingsPage({
	data,
	documents,
	isRefreshing,
	onRefresh,
}: {
	data: MerchantSettingsData;
	documents: MerchantKnowledgeDocumentsData;
	isRefreshing: boolean;
	onRefresh: () => void;
}) {
	const queryClient = useQueryClient();
	const saveWidgetSettings = useConvexMutation(api.merchantApp.updateWidgetSettings);
	const beginDocumentUpload = useConvexMutation(api.merchantDocuments.beginDocumentUpload);
	const finalizeDocumentUpload = useConvexAction(api.merchantDocuments.finalizeDocumentUpload);
	const uploadInlineDocument = useConvexAction(api.merchantDocuments.uploadInlineDocument);
	const deleteDocument = useConvexMutation(api.merchantDocuments.deleteDocument);
	const updateDocumentVisibility = useConvexMutation(
		api.merchantDocuments.updateDocumentVisibility,
	);
	const reprocessDocument = useConvexMutation(api.merchantDocuments.reprocessDocument);
	const reprocessDocuments = useConvexMutation(api.merchantDocuments.reprocessDocuments);
	const documentFileInputRef = useRef<HTMLInputElement | null>(null);
	async function invalidateSettingsQueries() {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: merchantSettingsQuery.queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: merchantKnowledgeDocumentsQuery.queryKey,
			}),
			invalidateMerchantWorkspaceQueries(queryClient),
		]);
	}

	const saveMutation = useMutation({
		mutationFn: saveWidgetSettings,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: merchantSettingsQuery.queryKey,
			});
		},
	});
	const widgetForm = useForm({
		defaultValues: {
			accentColor: data.widgetSettings.accentColor,
			contactPolicy: data.widgetSettings.policyAnswers.contact,
			enabled: data.widgetSettings.enabled,
			greeting: data.widgetSettings.greeting,
			knowledgeSources: knowledgeSourcesToText(data.widgetSettings.knowledgeSources),
			position: data.widgetSettings.position,
			returnsPolicy: data.widgetSettings.policyAnswers.returns,
			shippingPolicy: data.widgetSettings.policyAnswers.shipping,
		},
		onSubmit: async ({ value }) => {
			await saveMutation.mutateAsync({
				accentColor: value.accentColor,
				enabled: value.enabled,
				greeting: value.greeting,
				knowledgeSources: textToKnowledgeSources(value.knowledgeSources),
				policyAnswers: {
					contact: value.contactPolicy,
					returns: value.returnsPolicy,
					shipping: value.shippingPolicy,
				},
				position: value.position,
			});
		},
	});
	const uploadDocumentMutation = useMutation({
		mutationFn: async (value: {
			content: string;
			file: File | null;
			fileName: string;
			title: string;
			visibility: "public" | "shop_private";
		}) => {
			if (value.file) {
				const upload = await beginDocumentUpload({
					fileName: value.file.name,
					mimeType: value.file.type || undefined,
					size: value.file.size,
				});
				const response = await fetch(upload.url, {
					body: value.file,
					headers: value.file.type
						? {
								"Content-Type": value.file.type,
							}
						: undefined,
					method: "PUT",
				});

				if (!response.ok) {
					throw new Error("The file upload to Cloudflare R2 failed.");
				}

				return await finalizeDocumentUpload({
					fileName: value.file.name,
					key: upload.key,
					mimeType: value.file.type || undefined,
					size: value.file.size,
					title: value.title,
					visibility: value.visibility,
				});
			}

			return await uploadInlineDocument({
				content: value.content,
				fileName: value.fileName || undefined,
				title: value.title,
				visibility: value.visibility,
			});
		},
		onSuccess: async () => {
			documentForm.reset();
			if (documentFileInputRef.current) {
				documentFileInputRef.current.value = "";
			}
			await invalidateSettingsQueries();
		},
	});
	const documentForm = useForm({
		defaultValues: {
			content: "",
			file: null as File | null,
			fileName: "",
			title: "",
			visibility: "shop_private" as "public" | "shop_private",
		},
		onSubmit: async ({ value }) => {
			await uploadDocumentMutation.mutateAsync(value);
		},
	});
	const deleteDocumentMutation = useMutation({
		mutationFn: deleteDocument,
		onSuccess: async () => {
			await invalidateSettingsQueries();
		},
	});
	const updateDocumentVisibilityMutation = useMutation({
		mutationFn: updateDocumentVisibility,
		onSuccess: async () => {
			await invalidateSettingsQueries();
		},
	});
	const reprocessDocumentsMutation = useMutation({
		mutationFn: reprocessDocuments,
		onSuccess: async () => {
			await invalidateSettingsQueries();
		},
	});
	const reprocessDocumentMutation = useMutation({
		mutationFn: reprocessDocument,
		onSuccess: async () => {
			await invalidateSettingsQueries();
		},
	});

	return (
		<div className="grid gap-5">
			<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
				<Panel
					description="Current install and webhook status."
					title="Install and webhook health"
				>
					<div className="flex flex-wrap gap-3">
						<StatusPill tone={installStatusTone(data.installHealth.installStatus)}>
							{data.installHealth.installStatus}
						</StatusPill>
						<StatusPill tone={statusTone(data.installHealth.tokenStatus)}>
							{data.installHealth.tokenStatus}
						</StatusPill>
						<StatusPill tone={data.webhookHealth.recentDeliveryCount > 0 ? "success" : "watch"}>
							{data.webhookHealth.recentDeliveryCount} recent deliveries
						</StatusPill>
						<StatusPill tone={data.webhookHealth.failedDeliveryCount > 0 ? "blocked" : "neutral"}>
							{data.webhookHealth.failedDeliveryCount} failed deliveries
						</StatusPill>
					</div>

					<div className="mt-5">
						<DetailRow label="Shop" value="Connected Shopify shop" />
						<DetailRow label="App URL" value={data.installHealth.appUrl} />
						<DetailRow
							label="Scopes"
							value={
								data.installHealth.scopes.length > 0
									? data.installHealth.scopes.join(", ")
									: "Not recorded yet"
							}
						/>
						<DetailRow
							label="Last token exchange"
							value={data.installHealth.lastTokenExchangeAt ?? "Not recorded yet"}
						/>
						<DetailRow
							label="Last embedded auth"
							value={data.installHealth.lastAuthenticatedAt ?? "Not recorded yet"}
						/>
						<DetailRow
							label="Recent topics"
							value={
								data.webhookHealth.recentTopics.length > 0
									? data.webhookHealth.recentTopics.join(", ")
									: "Not recorded yet"
							}
						/>
						<DetailRow
							label="Last successful cache refresh"
							value={
								data.cacheHealth.lastSuccessfulRefreshAt ??
								"Not recorded yet"
							}
						/>
					</div>
				</Panel>

				<Panel
					description="Theme embed status and activation."
					title="Storefront embed status"
				>
					<div className="flex flex-wrap items-center gap-3">
						<StatusPill tone={embedStatusTone(data.extensionStatus.status)}>
							{data.extensionStatus.status}
						</StatusPill>
						{data.extensionStatus.mainThemeName ? (
							<StatusPill tone="neutral">{data.extensionStatus.mainThemeName}</StatusPill>
						) : null}
					</div>

					<div className="mt-5 grid gap-4 md:grid-cols-2">
						<div className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800">
							<Subheading level={3}>Current theme</Subheading>
							<Text>
								{data.extensionStatus.mainThemeName
									? `${data.extensionStatus.mainThemeName}${data.extensionStatus.mainThemeId ? ` (${data.extensionStatus.mainThemeId})` : ""}`
									: "Theme not detected"}
							</Text>
						</div>
						<div className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800">
							<Subheading level={3}>Live embed state</Subheading>
							<Text>
								{data.extensionStatus.status === "enabled"
									? "Embed is enabled."
									: data.extensionStatus.status === "disabled"
										? "Embed is installed but disabled."
										: data.extensionStatus.status === "not_detected"
											? "Embed has not been activated yet."
											: "Diagnostics unavailable until the app has a valid token."}
							</Text>
						</div>
					</div>

					{data.extensionStatus.errorMessage ? (
						<div className="mt-4">
							<EmptyState
								body={data.extensionStatus.errorMessage}
								title="Theme diagnostics error"
							/>
						</div>
					) : null}

					<div className="mt-5 flex flex-wrap gap-3">
						{data.extensionStatus.activationUrl ? (
							<Button color="dark/zinc" href={data.extensionStatus.activationUrl}>
								Open theme editor
							</Button>
						) : null}
						<Button outline disabled={isRefreshing} onClick={onRefresh} type="button">
							{isRefreshing ? "Refreshing..." : "Refresh diagnostics"}
						</Button>
					</div>
				</Panel>
			</div>

			<Panel
				description="Cache health and pending jobs."
				title="Cache freshness and workflows"
			>
				<div className="grid gap-4 md:grid-cols-2">
					{data.cacheHealth.caches.map((cache) => (
						<div
							className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800"
							key={cache.cacheKey}
						>
							<div className="flex flex-wrap items-center gap-2">
								<Subheading level={3}>{cache.cacheKey.replaceAll("_", " ")}</Subheading>
								<StatusPill tone={cacheStatusTone(cache.status)}>{cache.status}</StatusPill>
							</div>
							<Text>
								{cache.recordCount !== null
									? `${cache.recordCount} cached record(s) tracked.`
									: "No records tracked"}
							</Text>
							<Text>Requested: {cache.lastRequestedAt ?? "n/a"}</Text>
							<Text>Completed: {cache.lastCompletedAt ?? "n/a"}</Text>
							<Text>Last webhook: {cache.lastWebhookAt ?? "n/a"}</Text>
							{cache.pendingReason ? <Text>Reason: {cache.pendingReason}</Text> : null}
							{cache.lastError ? (
								<Text className="text-rose-700">Error: {cache.lastError}</Text>
							) : null}
						</div>
					))}
				</div>

				<div className="mt-5 grid gap-4 md:grid-cols-2">
					<div className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800">
						<Subheading level={3}>Pending workflows</Subheading>
						<Text>
							{data.cacheHealth.pendingJobCount} queued or running job(s) currently exist for this
							shop.
						</Text>
					</div>
					<div className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-4 dark:border-white/10 dark:bg-zinc-800">
						<Subheading level={3}>Stale warnings</Subheading>
						<Text>
							{data.cacheHealth.staleWarnings.length > 0
								? `${data.cacheHealth.staleWarnings.length} warning(s) need review.`
								: "No warnings"}
						</Text>
					</div>
				</div>

				{data.cacheHealth.staleWarnings.length > 0 ? (
					<div className="mt-5 space-y-3">
						{data.cacheHealth.staleWarnings.map((warning) => (
							<div
								className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950"
								key={warning}
							>
								{warning}
							</div>
						))}
					</div>
				) : null}
			</Panel>

			<Panel
				description="Configure the storefront chat widget."
				title="Storefront widget controls"
			>
				<form
					className="grid gap-5"
					onSubmit={(event) => {
						event.preventDefault();
						void widgetForm.handleSubmit();
					}}
				>
					<Fieldset>
						<FieldGroup>
							<widgetForm.Field name="enabled">
								{(field) => (
									<CheckboxField>
										<Checkbox checked={field.state.value} onChange={field.handleChange} />
										<Label>{field.state.value ? "Widget enabled" : "Widget disabled"}</Label>
										<Description>
											Controls whether the storefront assistant is visible to shoppers.
										</Description>
									</CheckboxField>
								)}
							</widgetForm.Field>

							<div className="grid gap-5 lg:grid-cols-2">
								<widgetForm.Field name="greeting">
									{(field) => (
										<Field>
											<Label>Greeting</Label>
											<Textarea
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												rows={4}
												value={field.state.value}
											/>
										</Field>
									)}
								</widgetForm.Field>
								<widgetForm.Field name="knowledgeSources">
									{(field) => (
										<Field>
											<Label>Public knowledge sources</Label>
											<Textarea
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												placeholder={"Shipping policy\nReturns page\nCollections overview"}
												rows={4}
												value={field.state.value}
											/>
										</Field>
									)}
								</widgetForm.Field>
							</div>

							<div className="grid gap-5 lg:grid-cols-3">
								<widgetForm.Field name="shippingPolicy">
									{(field) => (
										<Field>
											<Label>Shipping policy answer</Label>
											<Textarea
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												rows={4}
												value={field.state.value}
											/>
										</Field>
									)}
								</widgetForm.Field>
								<widgetForm.Field name="returnsPolicy">
									{(field) => (
										<Field>
											<Label>Returns policy answer</Label>
											<Textarea
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												rows={4}
												value={field.state.value}
											/>
										</Field>
									)}
								</widgetForm.Field>
								<widgetForm.Field name="contactPolicy">
									{(field) => (
										<Field>
											<Label>Contact policy answer</Label>
											<Textarea
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												rows={4}
												value={field.state.value}
											/>
										</Field>
									)}
								</widgetForm.Field>
							</div>

							<div className="grid gap-5 md:grid-cols-2">
								<widgetForm.Field name="position">
									{(field) => (
										<Field>
											<Label>Widget position</Label>
											<Select
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) =>
													field.handleChange(
														event.target
															.value as MerchantSettingsData["widgetSettings"]["position"],
													)
												}
												value={field.state.value}
											>
												<option value="bottom-right">Bottom right</option>
												<option value="bottom-left">Bottom left</option>
											</Select>
										</Field>
									)}
								</widgetForm.Field>
								<widgetForm.Field name="accentColor">
									{(field) => (
										<Field>
											<Label>Accent color</Label>
											<Input
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												placeholder="#0f172a"
												value={field.state.value}
											/>
										</Field>
									)}
								</widgetForm.Field>
							</div>
						</FieldGroup>
					</Fieldset>

					<div className="flex flex-wrap items-center gap-3">
						<Button color="dark/zinc" disabled={saveMutation.isPending} type="submit">
							{saveMutation.isPending ? "Saving..." : "Save widget settings"}
						</Button>
						{saveMutation.isSuccess ? <StatusPill tone="success">saved</StatusPill> : null}
						{saveMutation.error ? (
							<StatusPill tone="blocked">{saveMutation.error.message}</StatusPill>
						) : null}
					</div>
				</form>
			</Panel>

			<Panel
				description="Upload documents to give the copilot store-specific context."
				title="Knowledge documents"
			>
				<div className="flex flex-wrap items-center gap-3">
					<StatusPill tone="accent">{documents.documents.length} document(s)</StatusPill>
					<Button
						outline
						disabled={reprocessDocumentsMutation.isPending}
						onClick={() => reprocessDocumentsMutation.mutate({})}
						type="button"
					>
						{reprocessDocumentsMutation.isPending ? "Queueing..." : "Queue re-index workflow"}
					</Button>
				</div>

				<form
					className="mt-6 grid gap-5"
					onSubmit={(event) => {
						event.preventDefault();
						void documentForm.handleSubmit();
					}}
				>
					<Fieldset>
						<FieldGroup>
							<div className="grid gap-5 lg:grid-cols-3">
								<documentForm.Field name="title">
									{(field) => (
										<Field>
											<Label>Document title</Label>
											<Input
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												placeholder="Returns SOP"
												value={field.state.value}
											/>
										</Field>
									)}
								</documentForm.Field>
								<documentForm.Field name="fileName">
									{(field) => (
										<Field>
											<Label>Inline file name</Label>
											<Input
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) => field.handleChange(event.target.value)}
												placeholder="returns-sop.md"
												value={field.state.value}
											/>
										</Field>
									)}
								</documentForm.Field>
								<documentForm.Field name="visibility">
									{(field) => (
										<Field>
											<Label>Visibility</Label>
											<Select
												name={field.name}
												onBlur={field.handleBlur}
												onChange={(event) =>
													field.handleChange(event.target.value as "public" | "shop_private")
												}
												value={field.state.value}
											>
												<option value="shop_private">Shop private</option>
												<option value="public">Public</option>
											</Select>
										</Field>
									)}
								</documentForm.Field>
							</div>

							<documentForm.Field name="file">
								{(field) => (
									<Field>
										<Label>Upload a file</Label>
										<input
											accept=".pdf,.txt,.md,.markdown,.docx,.csv,text/plain,text/markdown,text/csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
											onChange={(event) => field.handleChange(event.target.files?.[0] ?? null)}
											ref={documentFileInputRef}
											type="file"
										/>
										<Description>
											File uploads take priority over pasted text.
										</Description>
										{field.state.value ? (
											<StatusPill tone="accent">
												{field.state.value.name} · {(field.state.value.size / 1024).toFixed(1)} KB
											</StatusPill>
										) : null}
									</Field>
								)}
							</documentForm.Field>

							<documentForm.Field name="content">
								{(field) => (
									<Field>
										<Label>Inline document content</Label>
										<Textarea
											name={field.name}
											onBlur={field.handleBlur}
											onChange={(event) => field.handleChange(event.target.value)}
											placeholder="Paste document content here..."
											rows={6}
											value={field.state.value}
										/>
									</Field>
								)}
							</documentForm.Field>
						</FieldGroup>
					</Fieldset>

					<div className="flex flex-wrap items-center gap-3">
						<Button color="dark/zinc" disabled={uploadDocumentMutation.isPending} type="submit">
							{uploadDocumentMutation.isPending ? "Uploading..." : "Upload or index document"}
						</Button>
						{uploadDocumentMutation.error ? (
							<StatusPill tone="blocked">{uploadDocumentMutation.error.message}</StatusPill>
						) : null}
					</div>
				</form>

				<div className="mt-6 space-y-4">
					{documents.documents.length > 0 ? (
						documents.documents.map((document) => (
							<article
								className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800"
								key={document.id}
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="max-w-3xl">
										<Text className="font-semibold text-zinc-950">{document.title}</Text>
										<Text>{document.summary}</Text>
										<Text>
											{document.fileName ?? "Inline upload"} · {document.sourceType} · updated{" "}
											{document.updatedAt}
											{document.chunkCount !== null ? ` · ${document.chunkCount} chunk(s)` : ""}
										</Text>
									</div>
									<div className="flex flex-wrap gap-2">
										<StatusPill
											tone={
												document.status === "ready"
													? "success"
													: document.status === "failed"
														? "blocked"
														: "watch"
											}
										>
											{document.status}
										</StatusPill>
										<StatusPill tone="neutral">{document.visibility}</StatusPill>
									</div>
								</div>

								<Text className="mt-4 rounded-[1rem] border border-zinc-950/5 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-900">
									{document.contentPreview}
								</Text>
								{document.failureReason ? (
									<Text className="mt-3 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-rose-900">
										{document.failureReason}
									</Text>
								) : null}

								<div className="mt-4 flex flex-wrap items-center gap-3">
									<Button
										outline
										disabled={reprocessDocumentMutation.isPending}
										onClick={() =>
											reprocessDocumentMutation.mutate({
												documentId: document.id as Id<"merchantDocuments">,
											})
										}
										type="button"
									>
										Reprocess
									</Button>
									<Button
										outline
										disabled={updateDocumentVisibilityMutation.isPending}
										onClick={() =>
											updateDocumentVisibilityMutation.mutate({
												documentId: document.id as Id<"merchantDocuments">,
												visibility:
													document.visibility === "shop_private" ? "public" : "shop_private",
											})
										}
										type="button"
									>
										Make {document.visibility === "shop_private" ? "public" : "private"}
									</Button>
									<Button
										outline
										disabled={deleteDocumentMutation.isPending}
										onClick={() =>
											deleteDocumentMutation.mutate({
												documentId: document.id as Id<"merchantDocuments">,
											})
										}
										type="button"
									>
										Delete
									</Button>
								</div>
							</article>
						))
					) : (
						<EmptyState
							body="Upload documents like SOPs, vendor notes, or product guides to help the copilot answer store-specific questions."
							title="No knowledge documents"
						/>
					)}
				</div>
			</Panel>
		</div>
	);
}
