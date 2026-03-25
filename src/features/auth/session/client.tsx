import { createContext, useContext, useSyncExternalStore } from "react";
import type { SessionEnvelope } from "@/shared/contracts/session";

type Listener = () => void;

export interface SessionManager {
	getState: () => SessionEnvelope;
	subscribe: (listener: Listener) => () => void;
}

const SessionContext = createContext<SessionManager | null>(null);

export function SessionProvider({
	children,
	manager,
}: {
	children: React.ReactNode;
	manager: SessionManager;
}) {
	return <SessionContext.Provider value={manager}>{children}</SessionContext.Provider>;
}

export function useSessionEnvelope() {
	const manager = useContext(SessionContext);

	if (!manager) {
		throw new Error("Session state must be consumed inside <SessionProvider />.");
	}

	return useSyncExternalStore(manager.subscribe, manager.getState, manager.getState);
}
