import { useConvexMutation } from "@convex-dev/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { EmptyState, StatusPill } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/layout";
import { merchantSettingsQuery } from "@/features/app-shell/merchant-settings";
import { api } from "@/lib/convex-api";
import type {
	MerchantSettingsData,
	ThemeAppEmbedStatus,
} from "@/shared/contracts/merchant-settings";

const primaryButtonClass =
	"inline-flex items-center justify-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass =
	"inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";
const detailCardClass = "rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4";
const inputClass =
	"w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400";

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

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-1 border-t border-slate-200 py-3 first:border-t-0 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
			<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">{label}</p>
			<p className="max-w-lg text-sm leading-6 text-slate-900">{value}</p>
		</div>
	);
}

export function MerchantSettingsPage({
	data,
	isRefreshing,
	onRefresh,
}: {
	data: MerchantSettingsData;
	isRefreshing: boolean;
	onRefresh: () => void;
}) {
	const queryClient = useQueryClient();
	const saveWidgetSettings = useConvexMutation(api.merchantApp.updateWidgetSettings);
	const [enabled, setEnabled] = useState(data.widgetSettings.enabled);
	const [greeting, setGreeting] = useState(data.widgetSettings.greeting);
	const [position, setPosition] = useState(data.widgetSettings.position);
	const [accentColor, setAccentColor] = useState(data.widgetSettings.accentColor);
	const [knowledgeSources, setKnowledgeSources] = useState(
		knowledgeSourcesToText(data.widgetSettings.knowledgeSources),
	);
	const [shippingPolicy, setShippingPolicy] = useState(data.widgetSettings.policyAnswers.shipping);
	const [returnsPolicy, setReturnsPolicy] = useState(data.widgetSettings.policyAnswers.returns);
	const [contactPolicy, setContactPolicy] = useState(data.widgetSettings.policyAnswers.contact);
	const saveMutation = useMutation({
		mutationFn: saveWidgetSettings,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: merchantSettingsQuery.queryKey,
			});
		},
	});

	useEffect(() => {
		setEnabled(data.widgetSettings.enabled);
		setGreeting(data.widgetSettings.greeting);
		setPosition(data.widgetSettings.position);
		setAccentColor(data.widgetSettings.accentColor);
		setKnowledgeSources(knowledgeSourcesToText(data.widgetSettings.knowledgeSources));
		setShippingPolicy(data.widgetSettings.policyAnswers.shipping);
		setReturnsPolicy(data.widgetSettings.policyAnswers.returns);
		setContactPolicy(data.widgetSettings.policyAnswers.contact);
	}, [data]);

	return (
		<div className="grid gap-5">
			<div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
				<Panel
					description="These values come from the authenticated shop installation record and current webhook history."
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
						<DetailRow
							label="Shop"
							value={`${data.installHealth.shopName} (${data.installHealth.shopDomain})`}
						/>
						<DetailRow label="App URL" value={data.installHealth.appUrl} />
						<DetailRow
							label="Scopes"
							value={
								data.installHealth.scopes.length > 0
									? data.installHealth.scopes.join(", ")
									: "No scopes recorded yet."
							}
						/>
						<DetailRow
							label="Last token exchange"
							value={data.installHealth.lastTokenExchangeAt ?? "No token exchange recorded yet."}
						/>
						<DetailRow
							label="Last embedded auth"
							value={data.installHealth.lastAuthenticatedAt ?? "No embedded auth recorded yet."}
						/>
						<DetailRow
							label="Recent topics"
							value={
								data.webhookHealth.recentTopics.length > 0
									? data.webhookHealth.recentTopics.join(", ")
									: "No webhook topics have been recorded yet."
							}
						/>
						<DetailRow
							label="Last successful cache refresh"
							value={
								data.cacheHealth.lastSuccessfulRefreshAt ??
								"No successful cache refresh has been recorded yet."
							}
						/>
					</div>
				</Panel>

				<Panel
					description="This checks the live theme and gives merchants a direct path into the theme editor."
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
						<div className={detailCardClass}>
							<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
								Current theme
							</p>
							<p className="mt-3 text-sm leading-6 text-slate-900">
								{data.extensionStatus.mainThemeName
									? `${data.extensionStatus.mainThemeName}${data.extensionStatus.mainThemeId ? ` (${data.extensionStatus.mainThemeId})` : ""}`
									: "The current live theme could not be resolved from Admin API diagnostics."}
							</p>
						</div>
						<div className={detailCardClass}>
							<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
								Live embed state
							</p>
							<p className="mt-3 text-sm leading-6 text-slate-900">
								{data.extensionStatus.status === "enabled"
									? "The app embed is enabled on the live theme."
									: data.extensionStatus.status === "disabled"
										? "The app embed exists on the live theme, but it is toggled off."
										: data.extensionStatus.status === "not_detected"
											? "The app embed has not been activated on the live theme yet."
											: "Theme diagnostics are unavailable until the app has a valid offline token."}
							</p>
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
							<a
								className={primaryButtonClass}
								href={data.extensionStatus.activationUrl}
								rel="noreferrer"
								target="_top"
							>
								Open theme editor
							</a>
						) : null}
						<button
							className={secondaryButtonClass}
							disabled={isRefreshing}
							onClick={onRefresh}
							type="button"
						>
							{isRefreshing ? "Refreshing..." : "Refresh diagnostics"}
						</button>
					</div>
				</Panel>
			</div>

			<Panel
				description="These caches exist only for repeated high-value reads. Shopify remains the source of truth for merchant mutations and canonical store state."
				title="Cache freshness and workflows"
			>
				<div className="grid gap-4 md:grid-cols-2">
					{data.cacheHealth.caches.map((cache) => (
						<div className={detailCardClass} key={cache.cacheKey}>
							<div className="flex flex-wrap items-center gap-2">
								<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
									{cache.cacheKey.replaceAll("_", " ")}
								</p>
								<StatusPill tone={cacheStatusTone(cache.status)}>{cache.status}</StatusPill>
							</div>
							<p className="mt-3 text-sm leading-6 text-slate-900">
								{cache.recordCount !== null
									? `${cache.recordCount} cached record(s) tracked.`
									: "No record count has been written for this cache yet."}
							</p>
							<p className="mt-2 text-sm leading-6 text-slate-600">
								Requested: {cache.lastRequestedAt ?? "n/a"}
							</p>
							<p className="text-sm leading-6 text-slate-600">
								Completed: {cache.lastCompletedAt ?? "n/a"}
							</p>
							<p className="text-sm leading-6 text-slate-600">
								Last webhook: {cache.lastWebhookAt ?? "n/a"}
							</p>
							{cache.pendingReason ? (
								<p className="mt-2 text-sm leading-6 text-slate-600">
									Reason: {cache.pendingReason}
								</p>
							) : null}
							{cache.lastError ? (
								<p className="mt-2 text-sm leading-6 text-rose-700">Error: {cache.lastError}</p>
							) : null}
						</div>
					))}
				</div>

				<div className="mt-5 grid gap-4 md:grid-cols-2">
					<div className={detailCardClass}>
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
							Pending workflows
						</p>
						<p className="mt-3 text-sm leading-6 text-slate-900">
							{data.cacheHealth.pendingJobCount} queued or running job(s) currently exist for this
							shop.
						</p>
					</div>
					<div className={detailCardClass}>
						<p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
							Stale warnings
						</p>
						<p className="mt-3 text-sm leading-6 text-slate-900">
							{data.cacheHealth.staleWarnings.length > 0
								? `${data.cacheHealth.staleWarnings.length} warning(s) need review.`
								: "No stale-cache warning is active right now."}
						</p>
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
				description="These settings drive the live storefront widget. Theme activation stays in the theme editor, while behavior and copy live here."
				title="Storefront widget controls"
			>
				<form
					className="grid gap-5"
					onSubmit={(event) => {
						event.preventDefault();
						saveMutation.mutate({
							accentColor,
							enabled,
							greeting,
							knowledgeSources: textToKnowledgeSources(knowledgeSources),
							policyAnswers: {
								contact: contactPolicy,
								returns: returnsPolicy,
								shipping: shippingPolicy,
							},
							position,
						});
					}}
				>
					<label className="grid gap-2">
						<span className="text-sm font-semibold text-slate-900">Public AI enabled</span>
						<span className="text-sm leading-6 text-slate-600">
							Disable this if the app embed should stay installed but the storefront assistant
							should stop rendering.
						</span>
						<label className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-slate-50 px-4 py-3">
							<input
								checked={enabled}
								className="size-4 rounded border border-slate-300 accent-slate-900"
								onChange={(event) => setEnabled(event.target.checked)}
								type="checkbox"
							/>
							<span className="text-sm font-semibold text-slate-900">
								{enabled ? "Widget enabled" : "Widget disabled"}
							</span>
						</label>
					</label>

					<div className="grid gap-5 lg:grid-cols-2">
						<label className="grid gap-2">
							<span className="text-sm font-semibold text-slate-900">Greeting</span>
							<textarea
								className={`${inputClass} min-h-28`}
								onChange={(event) => setGreeting(event.target.value)}
								value={greeting}
							/>
						</label>
						<label className="grid gap-2">
							<span className="text-sm font-semibold text-slate-900">Public knowledge sources</span>
							<textarea
								className={`${inputClass} min-h-28`}
								onChange={(event) => setKnowledgeSources(event.target.value)}
								placeholder={"Shipping policy\nReturns page\nCollections overview"}
								value={knowledgeSources}
							/>
						</label>
					</div>

					<div className="grid gap-5 lg:grid-cols-3">
						<label className="grid gap-2">
							<span className="text-sm font-semibold text-slate-900">Shipping policy answer</span>
							<textarea
								className={`${inputClass} min-h-28`}
								onChange={(event) => setShippingPolicy(event.target.value)}
								value={shippingPolicy}
							/>
						</label>
						<label className="grid gap-2">
							<span className="text-sm font-semibold text-slate-900">Returns policy answer</span>
							<textarea
								className={`${inputClass} min-h-28`}
								onChange={(event) => setReturnsPolicy(event.target.value)}
								value={returnsPolicy}
							/>
						</label>
						<label className="grid gap-2">
							<span className="text-sm font-semibold text-slate-900">Contact policy answer</span>
							<textarea
								className={`${inputClass} min-h-28`}
								onChange={(event) => setContactPolicy(event.target.value)}
								value={contactPolicy}
							/>
						</label>
					</div>

					<div className="grid gap-5 md:grid-cols-2">
						<label className="grid gap-2">
							<span className="text-sm font-semibold text-slate-900">Widget position</span>
							<select
								className={inputClass}
								onChange={(event) =>
									setPosition(
										event.target.value as MerchantSettingsData["widgetSettings"]["position"],
									)
								}
								value={position}
							>
								<option value="bottom-right">Bottom right</option>
								<option value="bottom-left">Bottom left</option>
							</select>
						</label>
						<label className="grid gap-2">
							<span className="text-sm font-semibold text-slate-900">Accent color</span>
							<input
								className={inputClass}
								onChange={(event) => setAccentColor(event.target.value)}
								placeholder="#0f172a"
								value={accentColor}
							/>
						</label>
					</div>

					<div className="flex flex-wrap items-center gap-3">
						<button className={primaryButtonClass} disabled={saveMutation.isPending} type="submit">
							{saveMutation.isPending ? "Saving..." : "Save widget settings"}
						</button>
						{saveMutation.isSuccess ? <StatusPill tone="success">saved</StatusPill> : null}
						{saveMutation.error ? (
							<StatusPill tone="blocked">{saveMutation.error.message}</StatusPill>
						) : null}
					</div>
				</form>
			</Panel>
		</div>
	);
}
