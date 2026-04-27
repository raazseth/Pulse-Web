const pending = new Map<string, Promise<unknown>>();

export function singleFlightByKey<T>(key: string, factory: () => Promise<T>): Promise<T> {
  const existing = pending.get(key) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }
  const promise = factory().finally(() => {
    pending.delete(key);
  }) as Promise<T>;
  pending.set(key, promise);
  return promise;
}
