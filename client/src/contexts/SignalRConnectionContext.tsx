/**
 * Single shared SignalR connection so wallet/bets and OREF handlers both receive server messages.
 * Without this, Main and useOrefAlerts each created their own connection; only one may receive broadcasts.
 */

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  HubConnection,
  HubConnectionState,
  HubConnectionBuilder,
  HttpTransportType,
  LogLevel,
} from "@microsoft/signalr";
import { getSignalRHubUrl } from "../utils/helper";

type SignalRConnectionContextValue = {
  connection: HubConnection | null;
  connectionState: HubConnectionState;
};

const SignalRConnectionContext = createContext<SignalRConnectionContextValue | null>(null);

export function useSignalRConnection(): SignalRConnectionContextValue | null {
  return useContext(SignalRConnectionContext);
}

export function SignalRConnectionProvider({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<HubConnection | null>(null);
  const [connectionState, setConnectionState] = useState<HubConnectionState>(HubConnectionState.Disconnected);
  const startedRef = useRef(false);

  useEffect(() => {
    const url = getSignalRHubUrl();
    const conn = new HubConnectionBuilder()
      .withUrl(url, { transport: HttpTransportType.WebSockets, skipNegotiation: true })
      .withServerTimeout(600000)
      .withKeepAliveInterval(5000)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    const updateState = () => setConnectionState(conn.state);

    conn.onreconnecting(updateState);
    conn.onreconnected(updateState);
    conn.onclose(updateState);

    setConnection(conn);
    updateState();

    (async () => {
      if (startedRef.current) return;
      startedRef.current = true;
      try {
        await conn.start();
        setConnectionState(conn.state);
      } catch (e) {
        console.error("Failed to start SignalR connection", e);
      }
    })();

    return () => {
      startedRef.current = false;
      void conn.stop();
      setConnection(null);
      setConnectionState(HubConnectionState.Disconnected);
    };
  }, []);

  const value = useMemo<SignalRConnectionContextValue>(
    () => ({ connection, connectionState }),
    [connection, connectionState]
  );

  return (
    <SignalRConnectionContext.Provider value={value}>
      {children}
    </SignalRConnectionContext.Provider>
  );
}
