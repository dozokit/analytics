export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) window.dispatchEvent(new Event("dozokit:signed-out"));
    throw new ApiError(body?.error ?? `The server answered ${res.status}.`, res.status);
  }
  return body as T;
}

export type * from "../../shared/types";

/** The picker's "All sites": every query reads all sites at once. */
export const ALL_SITES = "all";
