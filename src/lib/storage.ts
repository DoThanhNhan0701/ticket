export const getStorageItem = <T>(key: string): T | null => {
  const item = localStorage.getItem(key);
  if (!item) return null;
  try {
    return JSON.parse(item) as T;
  } catch {
    return item as unknown as T;
  }
};

export const setStorageItem = (key: string, value: unknown) => {
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  if (stringValue === undefined) {
    throw new TypeError("Storage values must be JSON serializable.");
  }
  localStorage.setItem(key, stringValue);
};

export const deleteStorageItem = (key: string) => {
  localStorage.removeItem(key);
};
