/**
 * Typed fetch wrapper for the Ops Hub API (all routes live under `/v1`).
 *
 * - Base URL comes from `VITE_API_URL`; the default is empty (same-origin),
 *   which flows through the Vite dev-server proxy (`/v1` → :3000). The API
 *   has no CORS middleware, so an absolute cross-origin default would be
 *   blocked by the browser.
 * - Auth: `Authorization: Bearer <token>` from the session store, injected
 *   via {@link setTokenProvider} to avoid a circular import.
 * - Errors: RFC 7807 `application/problem+json` → {@link ApiError}.
 * - 401: calls the handler registered with {@link setUnauthorizedHandler}
 *   (the auth store clears the session and redirects to `/login`).
 */

export interface Problem {
  type?: string | undefined;
  title: string;
  status: number;
  detail?: string | undefined;
  instance?: string | undefined;
  requestId?: string | undefined;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: Problem;

  constructor(problem: Problem) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.status = problem.status;
    this.problem = problem;
  }
}

function trimSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

const BASE_URL = trimSlashes(import.meta.env.VITE_API_URL ?? "");

let tokenProvider: () => string | null = () => null;

/** Registers the source of the bearer token (wired by `lib/auth/store`). */
export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

let onUnauthorized: ((error: ApiError) => void) | null = null;

/** Registers the 401 handler (wired by `lib/auth/store`). */
export function setUnauthorizedHandler(
  handler: (error: ApiError) => void,
): void {
  onUnauthorized = handler;
}

export interface ApiRequestInit {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Encoded as a JSON body. */
  body?: unknown;
  /** Query parameters; `undefined`/empty entries are dropped. */
  searchParams?: Record<string, string | number | undefined>;
  extraHeaders?: Record<string, string>;
  signal?: AbortSignal;
}

function buildUrl(
  path: string,
  searchParams: ApiRequestInit["searchParams"],
): string {
  let url = `${BASE_URL}${path}`;
  if (searchParams) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value !== undefined && value !== "") {
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    if (query !== "") {
      url += `?${query}`;
    }
  }
  return url;
}

async function parseProblem(response: Response): Promise<Problem> {
  const fallback: Problem = {
    title: response.statusText || "Request failed",
    status: response.status,
  };
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      typeof (body as { title?: unknown }).title === "string" &&
      typeof (body as { status?: unknown }).status === "number"
    ) {
      const problem = body as { title: string; status: number };
      const parsed: Problem = { title: problem.title, status: problem.status };
      const type = (body as { type?: unknown }).type;
      const detail = (body as { detail?: unknown }).detail;
      const instance = (body as { instance?: unknown }).instance;
      const requestId = (body as { requestId?: unknown }).requestId;
      if (typeof type === "string") {
        parsed.type = type;
      }
      if (typeof detail === "string") {
        parsed.detail = detail;
      }
      if (typeof instance === "string") {
        parsed.instance = instance;
      }
      if (typeof requestId === "string") {
        parsed.requestId = requestId;
      }
      return parsed;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function parseBody<T>(response: Response): Promise<T | undefined> {
  if (response.status === 204) {
    return undefined;
  }
  const text = await response.text();
  if (text === "") {
    return undefined;
  }
  return JSON.parse(text) as T;
}

export async function apiFetch<T>(
  path: string,
  init: ApiRequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = { ...init.extraHeaders };
  if (init.body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const token = tokenProvider();
  if (token !== null && token !== "") {
    headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    const requestInit: RequestInit = {
      method: init.method ?? "GET",
      headers,
    };
    if (init.signal !== undefined) {
      requestInit.signal = init.signal;
    }
    if (init.body !== undefined) {
      requestInit.body = JSON.stringify(init.body);
    }
    response = await fetch(buildUrl(path, init.searchParams), requestInit);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(
      error instanceof Error && error.message !== ""
        ? { title: "Network error", status: 0, detail: error.message }
        : { title: "Network error", status: 0 },
    );
  }

  if (!response.ok) {
    const problem = await parseProblem(response);
    const error = new ApiError(problem);
    // A 401 from the login endpoint itself is a wrong password, not an
    // expired session: running the global handler there would reload the
    // page and wipe the form before the user can read the error.
    if (
      response.status === 401 &&
      onUnauthorized !== null &&
      !path.startsWith("/v1/auth/login")
    ) {
      onUnauthorized(error);
    }
    throw error;
  }

  return (await parseBody<T>(response)) as T;
}

/** Downloads a file (e.g. a CSV export) with the session token attached. */
export async function downloadFile(
  path: string,
): Promise<{ blob: Blob; disposition: string | null }> {
  const headers: Record<string, string> = {};
  const token = tokenProvider();
  if (token !== null && token !== "") {
    headers.authorization = `Bearer ${token}`;
  }
  const response = await fetch(buildUrl(path, undefined), { headers });
  if (!response.ok) {
    throw new ApiError(await parseProblem(response));
  }
  return {
    blob: await response.blob(),
    disposition: response.headers.get("content-disposition"),
  };
}
