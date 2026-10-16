import { API_BASE_URL } from "@/config/api";
import type { ApiErrorShape } from "@/utils/errorHandler";

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  token?: string | null;
  body?: unknown;
  timeoutMs?: number;
};

export type UnauthorizedTokenRefreshHandler = (failedToken: string) => Promise<string | null>;

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
let unauthorizedTokenRefreshHandler: UnauthorizedTokenRefreshHandler | null = null;

export function setUnauthorizedTokenRefreshHandler(
  handler: UnauthorizedTokenRefreshHandler | null,
): void {
  unauthorizedTokenRefreshHandler = handler;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload: ApiErrorShape;

  constructor(status: number, payload: ApiErrorShape) {
    const message = Array.isArray(payload.message)
      ? payload.message.join("\n")
      : payload.message || `Yêu cầu thất bại (${status}).`;
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return apiRequestInternal<T>(path, options, true);
}

async function apiRequestInternal<T>(
  path: string,
  options: ApiRequestOptions,
  canRefreshToken: boolean,
): Promise<T> {
  const {
    token,
    body,
    headers,
    signal,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    ...requestOptions
  } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort(signal?.reason);
  if (signal?.aborted) forwardAbort();
  else signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  let response: Response;
  let responseText: string;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers: requestHeaders,
      signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    responseText = response.status === 204 ? "" : await response.text();
  } catch (cause) {
    if (timedOut) {
      throw new Error("Máy chủ không phản hồi trong thời gian chờ. Vui lòng thử lại.", {
        cause,
      });
    }
    if (signal?.aborted) throw new Error("Yêu cầu đã bị hủy.", { cause });
    throw new Error("Không thể kết nối máy chủ. Kiểm tra địa chỉ API và kết nối mạng.", {
      cause,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", forwardAbort);
  }

  if (response.status === 204) return undefined as T;
  let responseBody: unknown;
  try {
    responseBody = responseText ? JSON.parse(responseText) : undefined;
  } catch {
    responseBody = { message: responseText || response.statusText };
  }

  if (!response.ok) {
    const payload =
      typeof responseBody === "object" && responseBody !== null
        ? (responseBody as ApiErrorShape)
        : { message: String(responseBody ?? response.statusText) };

    if (response.status === 401 && token && canRefreshToken && unauthorizedTokenRefreshHandler) {
      const refreshedToken = await unauthorizedTokenRefreshHandler(token);
      if (refreshedToken && refreshedToken !== token) {
        return apiRequestInternal<T>(path, { ...options, token: refreshedToken }, false);
      }
    }

    throw new ApiError(response.status, { ...payload, code: payload.code ?? response.status });
  }

  return responseBody as T;
}
