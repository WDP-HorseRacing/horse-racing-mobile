import { useCallback, useEffect, useRef, useState } from "react";

export type ApiResourceState<T> = {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: unknown;
  retry: () => Promise<void>;
  refresh: () => Promise<void>;
};

export function useApiResource<T>(
  load: () => Promise<T>,
  enabled = true,
): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (refreshing: boolean) => {
      if (!enabled) return;
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const next = await load();
        if (mounted.current) setData(next);
      } catch (loadError) {
        if (mounted.current) setError(loadError);
      } finally {
        if (mounted.current) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [enabled, load],
  );

  useEffect(() => {
    if (enabled) void run(false);
    else {
      setData(null);
      setIsLoading(false);
      setError(null);
    }
  }, [enabled, run]);

  const retry = useCallback(() => run(false), [run]);
  const refresh = useCallback(() => run(true), [run]);

  return { data, isLoading, isRefreshing, error, retry, refresh };
}
