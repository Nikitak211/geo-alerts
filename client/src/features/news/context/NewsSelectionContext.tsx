import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from "react";
import type { NewsCluster, NewsItem } from "../types";

export type NewsScopeSelection =
  | { mode: "leaf"; item: NewsItem }
  | { mode: "cluster"; cluster: NewsCluster; focusItem?: NewsItem }
  | null;

type FlyToFn = (lon: number, lat: number, heightM: number) => void;

type NewsSelectionContextValue = {
  selection: NewsScopeSelection;
  openLeaf: (item: NewsItem) => void;
  openCluster: (cluster: NewsCluster, focusItem?: NewsItem) => void;
  close: () => void;
  registerFlyTo: (fn: FlyToFn | null) => void;
};

const NewsSelectionContext = createContext<NewsSelectionContextValue | null>(
  null
);

export const NewsSelectionProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [selection, setSelection] = useState<NewsScopeSelection>(null);
  const flyRef = useRef<FlyToFn | null>(null);

  const registerFlyTo = useCallback((fn: FlyToFn | null) => {
    flyRef.current = fn;
  }, []);

  const openLeaf = useCallback((item: NewsItem) => {
    flyRef.current?.(item.lon, item.lat, 80_000);
    setSelection({ mode: "leaf", item });
  }, []);

  const openCluster = useCallback(
    (cluster: NewsCluster, focusItem?: NewsItem) => {
      setSelection({ mode: "cluster", cluster, focusItem });
    },
    []
  );

  const close = useCallback(() => setSelection(null), []);

  const value = useMemo(
    () => ({
      selection,
      openLeaf,
      openCluster,
      close,
      registerFlyTo,
    }),
    [selection, openLeaf, openCluster, close, registerFlyTo]
  );

  return (
    <NewsSelectionContext.Provider value={value}>
      {children}
    </NewsSelectionContext.Provider>
  );
};

export function useNewsSelection(): NewsSelectionContextValue {
  const ctx = useContext(NewsSelectionContext);
  if (!ctx) {
    throw new Error(
      "useNewsSelection must be used within NewsSelectionProvider"
    );
  }
  return ctx;
}
