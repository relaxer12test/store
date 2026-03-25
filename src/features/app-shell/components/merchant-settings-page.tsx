import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import {
	FormCheckboxField,
	FormSection,
	FormSelectField,
	FormSubmitBar,
	FormTextareaField,
	FormTextField,
	MainForm,
} from "@/components/ui/form";
import { Panel } from "@/components/ui/layout";
import { MerchantModulePage } from "@/features/app-shell/components/merchant-module-page";
import type { ModuleSnapshot } from "@/shared/contracts/app-shell";

const primaryButtonClass =
	"inline-flex items-center justify-center rounded-full border border-slate-900 bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800";

export function MerchantSettingsPage({ snapshot }: { snapshot: ModuleSnapshot }) {
	const [savedMessage, setSavedMessage] = useState(
		"Preview changes are local only in this foundation slice.",
	);
	const form = useForm({
		defaultValues: {
			accentColor: "olive",
			enabled: true,
			greeting: "Welcome back. Ask about products, inventory, or operations.",
			position: "bottom-right",
			toneGuide: "Warm, decisive, commerce-aware, never imply discounts or refunds.",
		},
		onSubmit: async ({ value }) => {
			setSavedMessage(
				`Saved ${value.position} widget settings with ${value.enabled ? "public AI enabled" : "public AI disabled"}.`,
			);
		},
	});

	return (
		<div className="grid gap-5">
			<Panel
				description="This demonstrates the form contract: the feature owns one `useForm` call, while leaf controls consume form context through wrappers."
				title="Widget controls"
			>
				<MainForm
					form={form}
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
				>
					<FormSection
						description="Temporary preview settings until the real merchant settings mutations land."
						title="Public concierge"
					>
						<FormTextField
							description="The first shopper-facing line in the storefront embed."
							label="Greeting"
							name="greeting"
							placeholder="Ask me to compare products, build outfits, or find stock."
						/>
						<FormTextareaField
							description="Short internal note for how the merchant wants the public assistant framed."
							label="Tone guide"
							name="toneGuide"
							placeholder="Warm, decisive, commerce-aware, never promise discounts."
						/>
						<div className="grid gap-5 md:grid-cols-2">
							<FormSelectField
								label="Widget position"
								name="position"
								options={[
									{ label: "Bottom right", value: "bottom-right" },
									{ label: "Bottom left", value: "bottom-left" },
									{ label: "Inline section", value: "inline" },
								]}
							/>
							<FormSelectField
								label="Accent profile"
								name="accentColor"
								options={[
									{ label: "Olive brass", value: "olive" },
									{ label: "Terracotta", value: "terracotta" },
									{ label: "Pine", value: "pine" },
								]}
							/>
						</div>
						<FormCheckboxField
							description="This only controls the preview UI in this slice. Real storefront gating comes with the Shopify extension and backend settings plan."
							label="Enable public concierge"
							name="enabled"
						/>
					</FormSection>
					<FormSubmitBar hint={savedMessage}>
						<button className={primaryButtonClass} type="submit">
							Save preview settings
						</button>
					</FormSubmitBar>
				</MainForm>
			</Panel>
			<MerchantModulePage snapshot={snapshot} />
		</div>
	);
}
