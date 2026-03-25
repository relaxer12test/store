import type { ReactFormExtendedApi } from "@tanstack/react-form";
import { createContext, useContext, useId } from "react";
import { cn } from "@/lib/cn";

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

function FieldShell({
	children,
	description,
	error,
	label,
}: {
	children: React.ReactNode;
	description?: string;
	error?: string;
	label: string;
}) {
	return (
		<div className="grid gap-2">
			<span className="text-sm font-semibold text-slate-900">{label}</span>
			{description ? <span className="text-sm leading-6 text-slate-600">{description}</span> : null}
			{children}
			{error ? <span className="text-sm font-medium text-red-600">{error}</span> : null}
		</div>
	);
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
		<section className="rounded-[1.4rem] border border-slate-200 bg-slate-50 p-5">
			<div className="mb-4">
				<h3 className="font-serif text-2xl text-slate-950">{title}</h3>
				{description ? (
					<p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
				) : null}
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
	const inputId = useId();

	return (
		<form.Field name={name}>
			{(field: any) => (
				<FieldShell
					description={description}
					error={getErrorMessage(field.state.meta.errors[0])}
					label={label}
				>
					<input
						className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
						id={inputId}
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(event) => field.handleChange(event.target.value)}
						placeholder={placeholder}
						value={(field.state.value ?? "") as string}
					/>
				</FieldShell>
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
				<FieldShell
					description={description}
					error={getErrorMessage(field.state.meta.errors[0])}
					label={label}
				>
					<textarea
						className="min-h-28 rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(event) => field.handleChange(event.target.value)}
						placeholder={placeholder}
						value={(field.state.value ?? "") as string}
					/>
				</FieldShell>
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
				<FieldShell
					description={description}
					error={getErrorMessage(field.state.meta.errors[0])}
					label={label}
				>
					<select
						className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
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
					</select>
				</FieldShell>
			)}
		</form.Field>
	);
}

export function FormCheckboxField({ description, label, name }: BaseFieldProps) {
	const form = useMainForm();

	return (
		<form.Field name={name}>
			{(field: any) => (
				<label className="flex items-start gap-3 rounded-[1rem] border border-slate-200 bg-white p-4">
					<input
						checked={Boolean(field.state.value)}
						className="mt-1 size-4 rounded border border-slate-300 accent-slate-900"
						name={field.name}
						onBlur={field.handleBlur}
						onChange={(event) => field.handleChange(event.target.checked)}
						type="checkbox"
					/>
					<span>
						<span className="block text-sm font-semibold text-slate-900">{label}</span>
						{description ? (
							<span className="mt-1 block text-sm leading-6 text-slate-600">{description}</span>
						) : null}
					</span>
				</label>
			)}
		</form.Field>
	);
}

export function FormSubmitBar({ children, hint }: { children: React.ReactNode; hint: string }) {
	return (
		<div className="flex flex-col gap-3 rounded-[1.2rem] border border-slate-200 bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
			<p className="text-sm leading-6 text-slate-600">{hint}</p>
			<div>{children}</div>
		</div>
	);
}
