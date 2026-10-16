import { useCallback, useEffect, useRef, useState } from "react";

export type ApiResourceState<T> = {
  data: T | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: unknown;
  retry: () => Promise<void>;
  refresh: () => Promise<void>;
};

export class LatestRequestGuard {
  private generation = 0;

  begin(): number {
    this.generation += 1;
    return this.generation;
  }

  isCurrent(generation: number): boolean {
    return generation === this.generation;
  }

  invalidate(): void {
    this.generation += 1;
  }
}

export function useApiResource<T>(load: () => Promise<T>, enabled = true): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(true);
  const [requestGuard] = useState(() => new LatestRequestGuard());

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (refreshing: boolean) => {
      if (!enabled) return;
      const requestId = requestGuard.begin();
      if (refreshing) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const next = await load();
        if (mounted.current && requestGuard.isCurrent(requestId)) setData(next);
      } catch (loadError) {
        if (mounted.current && requestGuard.isCurrent(requestId)) setError(loadError);
      } finally {
        if (mounted.current && requestGuard.isCurrent(requestId)) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    [enabled, load, requestGuard],
  );

  useEffect(() => {
    const effectId = requestGuard.begin();
    if (enabled) {
      void Promise.resolve().then(() => {
        if (mounted.current && requestGuard.isCurrent(effectId)) void run(false);
      });
    } else {
      void Promise.resolve().then(() => {
        if (!mounted.current || !requestGuard.isCurrent(effectId)) return;
        setData(null);
        setIsLoading(false);
        setError(null);
      });
    }
    return () => requestGuard.invalidate();
  }, [enabled, run, requestGuard]);

  const retry = useCallback(() => run(false), [run]);
  const refresh = useCallback(() => run(true), [run]);

  return { data, isLoading, isRefreshing, error, retry, refresh };
}
