import type { MetricCard, SignalLine, TableRecord } from "./app-shell";

export interface SystemStatusSnapshot {
	metrics: MetricCard[];
	signals: SignalLine[];
	blockers: string[];
	shops: TableRecord[];
	syncJobs: TableRecord[];
	webhookDeliveries: TableRecord[];
	auditLogs: TableRecord[];
}
