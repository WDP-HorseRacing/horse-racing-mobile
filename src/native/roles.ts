import type { RoleId } from "@/lib/raceos-data";

export type RoleConfig = {
  id: RoleId;
  label: string;
  person: string;
  scope: string;
  workLabel: string;
  nav: { label: string; icon: string; path: string }[];
};

export const roleOrder: RoleId[] = ["trainer", "groom", "vet", "owner", "manager"];

export const roles: Record<RoleId, RoleConfig> = {
  trainer: {
    id: "trainer",
    label: "Head Trainer",
    person: "Elena Marsh",
    scope: "24 horses · Meadowline Stable",
    workLabel: "Training",
    nav: [
      { label: "Home", icon: "home-outline", path: "/trainer" },
      { label: "Horses", icon: "grid-outline", path: "/trainer/horses" },
      { label: "Training", icon: "calendar-outline", path: "/trainer/training" },
      { label: "Alerts", icon: "notifications-outline", path: "/trainer/alerts" },
      { label: "Profile", icon: "person-outline", path: "/profile/trainer" },
    ],
  },
  groom: {
    id: "groom",
    label: "Groom",
    person: "Mai Tran",
    scope: "A wing · 8 horses",
    workLabel: "Tasks",
    nav: [
      { label: "Home", icon: "home-outline", path: "/groom" },
      { label: "Tasks", icon: "checkmark-circle-outline", path: "/groom/tasks" },
      { label: "Stable", icon: "map-outline", path: "/groom/stable" },
      { label: "Report", icon: "camera-outline", path: "/groom/report" },
      { label: "Profile", icon: "person-outline", path: "/profile/groom" },
    ],
  },
  vet: {
    id: "vet",
    label: "Veterinarian",
    person: "Dr. Sanjay Rao",
    scope: "Medical authority · club-wide",
    workLabel: "Medical",
    nav: [
      { label: "Home", icon: "home-outline", path: "/vet" },
      { label: "Horses", icon: "grid-outline", path: "/vet/horses" },
      { label: "Medical", icon: "medkit-outline", path: "/vet/medical" },
      { label: "Alerts", icon: "notifications-outline", path: "/vet/alerts" },
      { label: "Profile", icon: "person-outline", path: "/profile/vet" },
    ],
  },
  owner: {
    id: "owner",
    label: "Horse Owner",
    person: "Marlow Bloodstock",
    scope: "3 horses owned",
    workLabel: "Racing",
    nav: [
      { label: "Home", icon: "home-outline", path: "/owner" },
      { label: "Horses", icon: "grid-outline", path: "/owner/horses" },
      { label: "Racing", icon: "trophy-outline", path: "/owner/racing" },
      { label: "Reports", icon: "bar-chart-outline", path: "/owner/reports" },
      { label: "Profile", icon: "person-outline", path: "/profile/owner" },
    ],
  },
  manager: {
    id: "manager",
    label: "Club Manager",
    person: "Clara Novak",
    scope: "Meadowline Racing Club",
    workLabel: "Operations",
    nav: [
      { label: "Home", icon: "home-outline", path: "/manager" },
      { label: "Horses", icon: "grid-outline", path: "/manager/horses" },
      { label: "Operations", icon: "business-outline", path: "/manager/operations" },
      { label: "Reports", icon: "bar-chart-outline", path: "/manager/reports" },
      { label: "Profile", icon: "person-outline", path: "/profile/manager" },
    ],
  },
};

export function isRole(value: string | string[] | undefined): value is RoleId {
  return typeof value === "string" && roleOrder.includes(value as RoleId);
}
