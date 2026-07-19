import { treaty } from "@elysiajs/eden";
import type { App } from "@evalio/backend";

declare const __BACKEND_URL__: string | undefined;
const base =
  typeof __BACKEND_URL__ !== "undefined"
    ? __BACKEND_URL__
    : "http://localhost:3000";

export const BASE_URL = base;

let refreshPromise: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchWithRetry(
  input: RequestInfo,
  init?: RequestInit,
  attempt = 0,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 500));
      return fetchWithRetry(input, init, attempt + 1);
    }
    throw err;
  }
}

async function authFetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const url = typeof input === "string" ? input : (input as Request).url;
  const isRefresh = url.includes("/api/auth/refresh");
  const isSessionCheck = url.includes("/api/auth/me");

  const res = await fetchWithRetry(input, { ...init, credentials: "include" });

  if (res.status === 401 && !isRefresh && !isSessionCheck) {
    if (!refreshPromise) {
      refreshPromise = doRefresh();
    }
    const refreshed = await refreshPromise;
    refreshPromise = null;

    if (refreshed) {
      return fetchWithRetry(input, { ...init, credentials: "include" });
    }

    window.dispatchEvent(new CustomEvent("auth:expired"));
  }

  return res;
}

export const client = treaty<App>(base, {
  fetcher: authFetch as typeof fetch,
});
