/**
 * Utilities for cleaning test artifacts and formatting medical & incident strings.
 */

export function isQaTestContent(text?: string | null): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes("kiểm tra flow") ||
    lower.includes("test local") ||
    lower.includes("qa test") ||
    lower.includes("[test]") ||
    lower.includes("seed test") ||
    lower.includes("test seed") ||
    lower.includes("test incident") ||
    lower.includes("flow 4 test") ||
    lower.includes("flow 3 test") ||
    lower.includes("flow 2 test") ||
    lower.includes("flow 1 test")
  );
}

export function formatExamStatus(status?: string | null): string {
  if (!status) return "Chờ khám";
  const s = status.toUpperCase();
  switch (s) {
    case "PENDING":
      return "Đang chờ khám";
    case "EXAMINED":
      return "Đã khám";
    case "DISMISSED":
      return "Đã bỏ qua";
    case "CANCELLED":
      return "Đã hủy";
    default:
      return status;
  }
}

export function formatIncidentSource(source?: string | null): string {
  if (!source) return "Hệ thống tự động";
  const s = source.toUpperCase();
  switch (s) {
    case "STAFF":
      return "Nhân viên chuồng trại";
    case "GROOM_INCIDENT":
    case "GROOM INCIDENT":
      return "Sự cố từ Groom";
    case "TRAINING_INCIDENT":
      return "Sự cố buổi tập";
    case "ROUTINE":
      return "Khám định kỳ";
    case "PERIODIC_CHECKUP":
      return "Khám tổng quát định kỳ";
    case "VET":
      return "Bác sĩ thú y chỉ định";
    default:
      return source.replaceAll("_", " ");
  }
}

export function formatCareTaskType(type?: string | null): string {
  if (!type) return "Chăm sóc y tế";
  const t = type.toUpperCase();
  switch (t) {
    case "VACCINATION":
      return "Tiêm phòng";
    case "FARRIER":
      return "Chăm sóc móng";
    case "DEWORMING":
      return "Tẩy giun";
    case "DENTAL":
      return "Khám nha khoa";
    case "CHECKUP":
      return "Khám định kỳ";
    case "REHABILITATION":
      return "Phục hồi chức năng";
    case "MEDICATION":
      return "Cho uống thuốc";
    case "BANDAGE_CHANGE":
      return "Thay băng vết thương";
    default:
      return type.replaceAll("_", " ");
  }
}
