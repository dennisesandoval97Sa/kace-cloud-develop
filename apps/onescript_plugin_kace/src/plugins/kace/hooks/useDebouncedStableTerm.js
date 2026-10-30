import { useEffect, useState } from 'react';

export function useDebouncedStableTerm(value, delayMs, enabled) {
  const [stable, setStable] = useState(() => String(value ?? ''));

  useEffect(() => {
    const next = String(value ?? '');
    if (!enabled) {
      setStable(next);
      return;
    }
    const id = setTimeout(() => {
      setStable(next);
    }, delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs, enabled]);

  return stable;
}
