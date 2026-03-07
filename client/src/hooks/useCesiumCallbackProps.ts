/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as Cesium from "cesium";
import { useMemo, useRef } from "react";

type RefName<K extends string> = `${K}Ref`;

type CallbackMap<K extends string, T> = {
  [P in K]: Cesium.Property;
} & {
  [P in RefName<K>]: React.MutableRefObject<T | undefined>;
};

export function useCesiumCallbackProps<T, K extends string = string>(
  keys: readonly K[],
): CallbackMap<K, T> {
  const storeRef = useRef<
    Record<string, { ref: React.MutableRefObject<T | undefined>; prop: Cesium.CallbackProperty }>
  >({});

  return useMemo(() => {
    const store = storeRef.current;
    const out = {} as CallbackMap<K, T>;

    keys.forEach((key) => {
      const storeKey = key;

      if (!store[storeKey]) {
        const ref: React.MutableRefObject<T | undefined> = {
          current: undefined as T | undefined,
        };
        const prop = new Cesium.CallbackProperty(() => ref.current, false);
        store[storeKey] = { ref, prop };
      }

      const { ref, prop } = store[storeKey];

      (out as any)[storeKey] = prop;
      (out as any)[`${storeKey}Ref`] = ref;
    });

    return out;
  }, [keys]);
}
