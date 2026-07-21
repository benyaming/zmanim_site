/**
 * Functional in-memory localStorage for unit tests — the jsdom environment
 * here exposes only an inert stub, and the sync modules need real
 * get/set/remove semantics.
 */
export function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}
