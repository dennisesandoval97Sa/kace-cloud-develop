const inFlight = new Map();

export const runInFlight = async (key, fn) => {
  const existing = inFlight.get(key);
  if (existing) return existing;
  const p = (async () => {
    try {
      return await fn();
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, p);
  return p;
};
