import type { ReactFormExtendedApi } from "@tanstack/react-form";
import { createContext, useContext } from "react";
import { cn } from "@/lib/cn";
import { Checkbox, CheckboxField } from "@/components/ui/cata/checkbox";
import { Field, Label, Description, ErrorMessage } from "@/components/ui/cata/fieldset";
import { Subheading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Select } from "@/components/ui/cata/select";
import { Textarea } from "@/components/ui/cata/textarea";
import { Text } from "@/components/ui/cata/text";

type MainFormApi = ReactFormExtendedApi<any, any, any, any, any, any, any, any, any, any, any, any>;

const MainFormContext = createContext<MainFormApi | null>(null);

function useMainForm() {
	const form = useContext(MainFormContext);

	if (!form) {
		throw new Error("Form field wrappers must be rendered inside <MainForm />.");
	}

	return form;
}

function getErrorMessage(error: unknown) {
	if (typeof error === "string") {
		return error;
	}

	if (error instanceof Error) {
		return error.message;
	}

	return undefined;
}

interface MainFormProps {
	children: React.ReactNode;
	className?: string;
	form: MainFormApi;
	onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}

export function MainForm({ children, className, form, onSubmit }: MainFormProps) {
	return (
		<MainFormContext.Provider value={form}>
			<form className={cn("grid gap-8", className)} onSubmit={onSubmit}>
				{children}
			</form>
		</MainFormContext.Provider>
	);
}

export function FormSection({
	children,
	description,
	title,
}: {
	children: React.ReactNode;
	description?: string;
	title: string;
}) {
	return (
		<section className="rounded-lg border border-zinc-950/5 bg-zinc-50 p-5 dark:border-white/10 dark:bg-zinc-800">
			<div className="mb-4">
				<Subheading level={3}>{title}</Subheading>
				{description ? <Text className="mt-2">{description}</Text> : null}
			</div>
			<div className="grid gap-5">{children}</div>
		</section>
	);
}

interface BaseFieldProps {
	description?: string;
	label: string;
	name: string;
}

export function FormTextField({
	description,
	label,
	name,
	placeholder,
}: BaseFieldProps & { placeholder?: string }) {
	const form = useMainForm();

	return (
		<form.Field name={name}>
			{(field: any) => (
				<Field>
					<Label>{label}</Label>
					{description ? <Description>{description}</Description> : null}
					<Input
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(event) => field.handleChange(event.target.value)}
						placeholder={placeholder}
						value={(field.state.value ?? "") as string}
					/>
					{getErrorMessage(field.state.meta.errors[0]) ? (
						<ErrorMessage>{getErrorMessage(field.state.meta.errors[0])}</ErrorMessage>
					) : null}
				</Field>
			)}
		</form.Field>
	);
}

export function FormTextareaField({
	description,
	label,
	name,
	placeholder,
}: BaseFieldProps & { placeholder?: string }) {
	const form = useMainForm();

	return (
		<form.Field name={name}>
			{(field: any) => (
				<Field>
					<Label>{label}</Label>
					{description ? <Description>{description}</Description> : null}
					<Textarea
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(event) => field.handleChange(event.target.value)}
						placeholder={placeholder}
						value={(field.state.value ?? "") as string}
					/>
					{getErrorMessage(field.state.meta.errors[0]) ? (
						<ErrorMessage>{getErrorMessage(field.state.meta.errors[0])}</ErrorMessage>
					) : null}
				</Field>
			)}
		</form.Field>
	);
}

export function FormSelectField({
	description,
	label,
	name,
	options,
}: BaseFieldProps & {
	options: Array<{ label: string; value: string }>;
}) {
	const form = useMainForm();

	return (
		<form.Field name={name}>
			{(field: any) => (
				<Field>
					<Label>{label}</Label>
					{description ? <Description>{description}</Description> : null}
					<Select
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(event) => field.handleChange(event.target.value)}
						value={(field.state.value ?? "") as string}
					>
						{options.map((option) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</Select>
					{getErrorMessage(field.state.meta.errors[0]) ? (
						<ErrorMessage>{getErrorMessage(field.state.meta.errors[0])}</ErrorMessage>
					) : null}
				</Field>
			)}
		</form.Field>
	);
}

export function FormCheckboxField({ description, label, name }: BaseFieldProps) {
	const form = useMainForm();

	return (
		<form.Field name={name}>
			{(field: any) => (
				<div className="rounded-lg border border-zinc-950/5 bg-white p-4 dark:border-white/10 dark:bg-white/5">
					<CheckboxField>
						<Checkbox
							checked={Boolean(field.state.value)}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(checked) => field.handleChange(checked)}
						/>
						<Label>{label}</Label>
						{description ? <Description>{description}</Description> : null}
					</CheckboxField>
				</div>
			)}
		</form.Field>
	);
}

export function FormSubmitBar({ children, hint }: { children: React.ReactNode; hint: string }) {
	return (
		<div className="flex flex-col gap-3 rounded-lg border border-zinc-950/5 bg-zinc-50 px-4 py-4 dark:border-white/10 dark:bg-zinc-800 md:flex-row md:items-center md:justify-between">
			<Text>{hint}</Text>
			<div>{children}</div>
		</div>
	);
}
