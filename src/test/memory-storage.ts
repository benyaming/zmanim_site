/**
 * Functional in-memory Web Storage for unit tests — the jsdom environment
 * here exposes only an inert stub, and the sync modules need real
 * get/set/remove semantics.
 */
function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
}

export function installMemoryLocalStorage(): void {
  Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
}

export function installMemorySessionStorage(): void {
  Object.defineProperty(window, 'sessionStorage', { value: memoryStorage(), configurable: true });
}
