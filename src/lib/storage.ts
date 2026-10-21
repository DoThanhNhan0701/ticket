export const getStorageItem = <T>(key: string): T | null => {
  let item: string | null;
  try {
    item = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (!item) return null;
  try {
    return JSON.parse(item) as T;
  } catch {
    return item as unknown as T;
  }
};

export const setStorageItem = (key: string, value: unknown) => {
  const stringValue = typeof value === "string" ? value : JSON.stringify(value);
  if (typeof value !== "string" && !stringValue) {
    throw new TypeError("Storage values must be JSON serializable.");
  }
  try {
    localStorage.setItem(key, stringValue);
  } catch {
    // Storage is optional when the browser blocks access or runs out of space.
  }
};

export const deleteStorageItem = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Signing out must still clear the in-memory session and cookies.
  }
};
