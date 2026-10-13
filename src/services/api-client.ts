import { API_BASE_URL } from "@/config/api";
import type { ApiErrorShape } from "@/utils/errorHandler";

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  token?: string | null;
  body?: unknown;
};

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
  const { token, body, headers, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  if (token) requestHeaders.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...requestOptions,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new Error("Không thể kết nối máy chủ. Kiểm tra địa chỉ API và kết nối mạng.", {
      cause,
    });
  }

  if (response.status === 204) return undefined as T;
  const responseText = await response.text();
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
    throw new ApiError(response.status, { ...payload, code: payload.code ?? response.status });
  }

  return responseBody as T;
}

