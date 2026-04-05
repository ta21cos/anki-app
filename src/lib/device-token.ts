const STORAGE_KEY = "device-token";

export function getDeviceToken(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;

  const token = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, token);
  return token;
}
