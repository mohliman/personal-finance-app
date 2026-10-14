export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
let csrf = "";
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(method !== "GET" ? { "X-CSRF-Token": csrf } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let result: { error?: string; csrf?: string };
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The server is unavailable. Start the backend and try again.",
    );
  }
  if (!response.ok) {
    if (response.status === 401)
      window.dispatchEvent(new Event("session-expired"));
    throw new ApiError(result.error ?? "Request failed.", response.status);
  }
  if (result.csrf) csrf = result.csrf;
  return result as T;
}
