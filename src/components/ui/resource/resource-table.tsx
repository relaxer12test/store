import type React from "react";
import { Button } from "@/components/ui/cata/button";
import { Heading } from "@/components/ui/cata/heading";
import { Input } from "@/components/ui/cata/input";
import { Select } from "@/components/ui/cata/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/cata/table";
import { Text } from "@/components/ui/cata/text";
import { EmptyState } from "@/components/ui/feedback";

export interface ResourcePageInfo {
	continueCursor: string | null;
	isDone: boolean;
}

export interface ResourceTableColumn<TRow> {
	cell: (row: TRow) => React.ReactNode;
	className?: string;
	header: string;
}

export function ResourceToolbar({
	children,
	searchPlaceholder,
	searchValue,
	onSearchChange,
	pageSize,
	pageSizeOptions,
	onPageSizeChange,
	sortValue,
	sortOptions,
	onSortChange,
}: {
	children?: React.ReactNode;
	onPageSizeChange: (value: number) => void;
	onSearchChange?: (value: string) => void;
	onSortChange: (value: string) => void;
	pageSize: number;
	pageSizeOptions: readonly number[];
	searchPlaceholder?: string;
	searchValue?: string;
	sortOptions: Array<{ label: string; value: string }>;
	sortValue: string;
}) {
	return (
		<div className="flex flex-wrap items-center gap-2 [&>[data-slot=control]]:w-auto">
			{onSearchChange ? (
				<Input
					className="!w-full sm:!w-auto sm:min-w-44"
					onChange={(event) => onSearchChange(event.target.value)}
					placeholder={searchPlaceholder ?? "Search"}
					value={searchValue ?? ""}
				/>
			) : null}
			<Select onChange={(event) => onSortChange(event.target.value)} value={sortValue}>
				{sortOptions.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</Select>
			<Select
				onChange={(event) => onPageSizeChange(Number(event.target.value))}
				value={String(pageSize)}
			>
				{pageSizeOptions.map((value) => (
					<option key={value} value={value}>
						{`${value} rows`}
					</option>
				))}
			</Select>
			{children}
		</div>
	);
}

export function ResourceTable<TRow>({
	columns,
	emptyBody,
	emptyTitle,
	getRowHref,
	getRowKey,
	getRowLabel,
	onNext,
	onPrevious,
	pageInfo: _pageInfo,
	rows,
}: {
	columns: ResourceTableColumn<TRow>[];
	emptyBody: string;
	emptyTitle: string;
	getRowHref: (row: TRow) => string;
	getRowKey: (row: TRow) => string;
	getRowLabel: (row: TRow) => string;
	onNext: (() => void) | null;
	onPrevious: (() => void) | null;
	pageInfo: ResourcePageInfo;
	rows: TRow[];
}) {
	return (
		<div className="[--gutter:--spacing(6)] sm:[--gutter:--spacing(8)]">
			{rows.length === 0 ? (
				<div className="rounded-xl border border-zinc-950/6 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
					<EmptyState body={emptyBody} title={emptyTitle} />
				</div>
			) : (
				<Table bleed>
					<TableHead>
						<TableRow>
							{columns.map((column) => (
								<TableHeader
									className={
										column.className ?? "text-[0.68rem] font-semibold uppercase tracking-[0.22em]"
									}
									key={column.header}
								>
									{column.header}
								</TableHeader>
							))}
						</TableRow>
					</TableHead>
					<TableBody>
						{rows.map((row) => (
							<TableRow href={getRowHref(row)} key={getRowKey(row)} title={getRowLabel(row)}>
								{columns.map((column) => (
									<TableCell className="align-top" key={column.header}>
										{column.cell(row)}
									</TableCell>
								))}
							</TableRow>
						))}
					</TableBody>
				</Table>
			)}

			{onPrevious || onNext ? (
				<div className="flex items-center justify-end gap-2 border-t border-zinc-950/5 px-[--gutter] py-3 dark:border-white/5">
					<Button disabled={!onPrevious} outline onClick={onPrevious ?? undefined}>
						Newer
					</Button>
					<Button disabled={!onNext} color="dark/zinc" onClick={onNext ?? undefined}>
						Older
					</Button>
				</div>
			) : null}
		</div>
	);
}

export function ResourceDetailCard({
	children,
	eyebrow = "Details",
	title,
}: React.PropsWithChildren<{ eyebrow?: string; title: string }>) {
	return (
		<section className="rounded-xl border border-zinc-950/6 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
			<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
				{eyebrow}
			</Text>
			<Text className="mt-2 text-lg/7 font-semibold text-zinc-950 dark:text-white">{title}</Text>
			<div className="mt-5 grid gap-5">{children}</div>
		</section>
	);
}

export function ResourceDetailPage({
	actions,
	backHref,
	backLabel = "Back to list",
	children,
	description,
	eyebrow = "Details",
	title,
}: React.PropsWithChildren<{
	actions?: React.ReactNode;
	backHref?: string;
	backLabel?: string;
	description?: string;
	eyebrow?: string;
	title: string;
}>) {
	return (
		<div className="grid gap-4">
			<header className="rounded-xl border border-zinc-950/6 bg-white px-5 py-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="max-w-3xl">
						{backHref ? (
							<div className="mb-4">
								<Button href={backHref} outline>
									{backLabel}
								</Button>
							</div>
						) : null}
						<Text className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-zinc-500">
							{eyebrow}
						</Text>
						<Heading className="mt-3">{title}</Heading>
						{description ? <Text className="mt-2">{description}</Text> : null}
					</div>
					{actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
				</div>
			</header>

			<div className="grid gap-4">{children}</div>
		</div>
	);
}
