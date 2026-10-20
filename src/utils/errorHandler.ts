import { Alert } from "react-native";

export type ValidationIssue = { field: string; message: string };

export type ApiErrorShape = {
  code?: number;
  message?: string | string[];
  errors?: ValidationIssue[];
};

export function extractErrorMessage(
  error: unknown,
  fallback = "Đã xảy ra lỗi. Vui lòng thử lại.",
): string {
  const shaped = getApiErrorShape(error);
  if (shaped?.errors?.length) return shaped.errors.map((issue) => issue.message).join("\n");
  if (Array.isArray(shaped?.message)) return shaped.message.join("\n");
  if (typeof shaped?.message === "string" && shaped.message.trim()) return shaped.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function extractFieldErrors(error: unknown): Record<string, string> {
  const issues = getApiErrorShape(error)?.errors ?? [];
  return issues.reduce<Record<string, string>>((result, issue) => {
    if (issue.field && issue.message && !result[issue.field]) result[issue.field] = issue.message;
    return result;
  }, {});
}

export function showApiError(error: unknown, title = "Không thể hoàn tất"): void {
  Alert.alert(title, extractErrorMessage(error));
}

function getApiErrorShape(error: unknown): ApiErrorShape | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("payload" in error && typeof error.payload === "object" && error.payload !== null) {
    return error.payload as ApiErrorShape;
  }
  return error as ApiErrorShape;
}
