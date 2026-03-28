import type { MetricCard, SignalLine, TableRecord } from "./app-shell";

export interface SystemStatusOverview {
	metrics: MetricCard[];
	signals: SignalLine[];
	blockers: string[];
}

export interface SystemStatusSnapshot {
	metrics: MetricCard[];
	signals: SignalLine[];
	blockers: string[];
	shops: TableRecord[];
	cacheStates: TableRecord[];
	syncJobs: TableRecord[];
	webhookDeliveries: TableRecord[];
	auditLogs: TableRecord[];
}
