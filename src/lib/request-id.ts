const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRequestId(storageKey: string): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const stored = window.sessionStorage.getItem(storageKey);
  if (stored && UUID_PATTERN.test(stored)) return stored;
  return renewRequestId(storageKey);
}

export function renewRequestId(storageKey: string): string {
  const requestId = crypto.randomUUID();
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(storageKey, requestId);
  }
  return requestId;
}
