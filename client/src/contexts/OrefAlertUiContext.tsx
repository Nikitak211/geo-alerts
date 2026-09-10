import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type FC,
  type ReactNode,
} from "react";
import type { AlertPayload } from "../types";

export type OrefAlertUiValue = {
  connected: boolean;
  alerts: AlertPayload[];
  blinking: Record<string, boolean>;
  soundEnabled: boolean;
  ready: boolean;
  testAlert: () => void | Promise<void>;
  clearAlerts: () => void;
  enableSound: () => void | Promise<void>;
  disableSound: () => void;
  unlockSound: () => void;
  /** Called by AlertTester to push live UI state. */
  publish: ( partial: Partial<Omit<OrefAlertUiValue, "publish" | "ready">> & {
    ready?: boolean;
  }) => void;
};

const noop = () => {};

const defaultValue: OrefAlertUiValue = {
  connected: false,
  alerts: [],
  blinking: {},
  soundEnabled: true,
  ready: false,
  testAlert: noop,
  clearAlerts: noop,
  enableSound: noop,
  disableSound: noop,
  unlockSound: noop,
  publish: noop,
};

const OrefAlertUiContext = createContext<OrefAlertUiValue>(defaultValue);

export const OrefAlertUiProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<Omit<OrefAlertUiValue, "publish">>({
    connected: false,
    alerts: [],
    blinking: {},
    soundEnabled: true,
    ready: false,
    testAlert: noop,
    clearAlerts: noop,
    enableSound: noop,
    disableSound: noop,
    unlockSound: noop,
  });

  const publish = useCallback(
    (partial: Partial<Omit<OrefAlertUiValue, "publish">>) => {
      setState((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const value = useMemo(
    () => ({ ...state, publish }),
    [state, publish]
  );

  return (
    <OrefAlertUiContext.Provider value={value}>
      {children}
    </OrefAlertUiContext.Provider>
  );
};

export function useOrefAlertUi(): OrefAlertUiValue {
  return useContext(OrefAlertUiContext);
}
