import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

export function useRefreshOnFocus(refresh: () => Promise<void>): void {
  const focusedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void refresh();
      else focusedOnce.current = true;
      return undefined;
    }, [refresh]),
  );
}
