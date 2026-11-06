import { useCallback, useEffect, useRef, useState } from 'react';

export function useDashboardData(loader, dependencies = []) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [live, setLive] = useState(false);
  const [data, setData] = useState(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await loaderRef.current();
      setData(result.data);
      setLive(result.live === true);
    } catch {
      setData(null);
      setLive(false);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    reload();
  }, [reload]);

  return { loading, error, live, data, reload };
}

export function settledValue(result) {
  if (!result || result.status !== 'fulfilled') {
    return { ok: false, value: null, live: true };
  }
  return {
    ok: true,
    value: result.value,
    live: result.value?.isLiveBackend !== false,
  };
}
