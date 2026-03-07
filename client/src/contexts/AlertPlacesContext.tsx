import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import type { GeoBox } from "../types";

export type AlertPlace = { place: string; title: string };

type AlertPlacesContextValue = {
  places: AlertPlace[];
  setPlaces: (places: AlertPlace[] | ((prev: AlertPlace[]) => AlertPlace[])) => void;
  serverPositions: Record<string, GeoBox>;
  setServerPositions: (v: Record<string, GeoBox> | ((prev: Record<string, GeoBox>) => Record<string, GeoBox>)) => void;
  clearAll: () => void;
};

const AlertPlacesContext = createContext<AlertPlacesContextValue | null>(null);

export function AlertPlacesProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<AlertPlace[]>([]);
  const [serverPositions, setServerPositions] = useState<Record<string, GeoBox>>({});

  const clearAll = useCallback(() => {
    setPlaces([]);
    setServerPositions({});
  }, []);

  return (
    <AlertPlacesContext.Provider
      value={{ places, setPlaces, serverPositions, setServerPositions, clearAll }}
    >
      {children}
    </AlertPlacesContext.Provider>
  );
}

export function useAlertPlaces(): AlertPlacesContextValue {
  const ctx = useContext(AlertPlacesContext);
  if (!ctx)
    throw new Error("useAlertPlaces must be used within AlertPlacesProvider");
  return ctx;
}
