import { Text } from "@/components/ui/cata/text";
import { StatusPill } from "@/components/ui/feedback";

export function formatTimestampLabel(value: string | null | undefined) {
	if (!value) {
		return "n/a";
	}

	const parsed = Date.parse(value);

	return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : value;
}

export function getStatusTone(value: string | null | undefined) {
	if (!value) {
		return "neutral" as const;
	}

	const normalized = value.toLowerCase();

	if (
		normalized.includes("connected") ||
		normalized.includes("success") ||
		normalized.includes("active") ||
		normalized.includes("ready")
	) {
		return "success" as const;
	}

	if (
		normalized.includes("failed") ||
		normalized.includes("inactive") ||
		normalized.includes("blocked") ||
		normalized.includes("error")
	) {
		return "blocked" as const;
	}

	if (
		normalized.includes("pending") ||
		normalized.includes("queued") ||
		normalized.includes("retry") ||
		normalized.includes("refusal")
	) {
		return "watch" as const;
	}

	return "neutral" as const;
}

export function CodeValue({ value }: { value: string | null | undefined }) {
	return (
		<Text className="break-all font-mono text-xs/6 text-zinc-600 dark:text-zinc-300">
			{value ?? "n/a"}
		</Text>
	);
}

export function StatusValue({ value }: { value: string | null | undefined }) {
	return <StatusPill tone={getStatusTone(value)}>{value ?? "n/a"}</StatusPill>;
}
