import { useCallback, useEffect, useRef } from "react";
import { useFocusEffect } from "expo-router";

export function useRefreshOnFocus(refresh: () => Promise<void>): void {
  const focusedOnce = useRef(false);
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) void refreshRef.current();
      else focusedOnce.current = true;
      return undefined;
    }, []),
  );
}
