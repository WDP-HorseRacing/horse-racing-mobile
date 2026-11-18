import type { NotificationDto } from "@/adapters/notifications.adapter";
import type { RoleId } from "@/types/raceos";

export function notificationTarget(notification: NotificationDto, role: RoleId): string {
  const resource = notification.resource;
  const category = notification.category;
  const horseId =
    resource?.horseId ?? (resource?.type.toUpperCase() === "HORSE" ? resource.id : undefined);

  if (category === "SUPPLY") return `/${role}/inventory`;
  if (category === "INCIDENT") return role === "groom" ? "/groom/report" : `/${role}/incidents`;
  if (category === "EXAM_REQUEST" && role === "vet") return "/vet/medical/requests";
  if (category === "DAILY_CHECKLIST") {
    if (role === "groom") return "/groom/tasks";
    if (role === "manager") return "/manager/operations";
    return `/${role}/work`;
  }
  if (category === "TRAINING_CLASS" && role === "trainer") return "/trainer/training";
  if (category === "TRAINING_SESSION") {
    if (role === "groom") return "/groom/training";
    if (role === "owner") return "/owner/training";
    if (role === "manager") return "/manager/training";
    if (role === "trainer") return "/trainer/training";
  }
  if (resource?.type.toUpperCase() === "TRAINING_LOCK" && role === "vet") {
    return `/vet/lock/${encodeURIComponent(resource.id)}`;
  }
  if (role === "owner" && category === "HORSE_LIFECYCLE") return "/owner/past-horses";
  if (resource?.type.toUpperCase() === "MEDICAL_CASE") {
    return `/${role}/medical/cases/${encodeURIComponent(resource.id)}`;
  }
  if (resource?.type.toUpperCase() === "SESSION_PARTICIPANT") {
    if (role === "trainer" || role === "vet") {
      return `/${role}/participant/${encodeURIComponent(resource.id)}`;
    }
  }
  if (category === "MEASUREMENT_ALERT" && horseId) {
    return `/${role}/horse/${encodeURIComponent(horseId)}/measurements`;
  }
  if (horseId) return `/${role}/horse/${encodeURIComponent(horseId)}`;
  if (role === "owner" && category === "MEDICAL_CASE") return "/owner/medical/cases";
  if (category === "EXAM_REQUEST") return `/${role}/medical`;
  return `/${role}`;
}
