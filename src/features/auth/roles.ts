import type { RoleId } from "@/lib/raceos-data";

export type RoleConfig = {
  id: RoleId;
  label: string;
  person: string;
  scope: string;
  workLabel: string;
  nav: { label: string; icon: string; path?: string; action?: "more" }[];
  /** Less frequently used destinations. These stay reachable outside the bottom bar. */
  secondary: { label: string; icon: string; path: string; description: string }[];
};

export const MAX_BOTTOM_NAV_ITEMS = 5;

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
      { label: "Incidents", icon: "alert-circle-outline", path: "/trainer/incidents" },
      { label: "More", icon: "ellipsis-horizontal", action: "more" },
    ],
    secondary: [
      {
        label: "Stable",
        icon: "home-outline",
        path: "/trainer/stable",
        description: "Barn, stall and Groom assignments.",
      },
      {
        label: "Alerts",
        icon: "notifications-outline",
        path: "/trainer/alerts",
        description: "Review club notifications and alerts.",
      },
      {
        label: "Supplies",
        icon: "cube-outline",
        path: "/trainer/inventory",
        description: "View and manage supplies.",
      },
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
      { label: "Incidents", icon: "alert-circle-outline", path: "/groom/report" },
      { label: "More", icon: "ellipsis-horizontal", action: "more" },
    ],
    secondary: [
      {
        label: "Training",
        icon: "calendar-outline",
        path: "/groom/training",
        description: "View and record training sessions.",
      },
      {
        label: "Inventory",
        icon: "cube-outline",
        path: "/groom/inventory",
        description: "Check supplies and submit a stock request.",
      },
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
      { label: "Incidents", icon: "alert-circle-outline", path: "/vet/incidents" },
      { label: "Medical", icon: "medkit-outline", path: "/vet/medical" },
      { label: "More", icon: "ellipsis-horizontal", action: "more" },
    ],
    secondary: [
      {
        label: "Examination requests",
        icon: "clipboard-outline",
        path: "/vet/medical/requests",
        description: "Triage and review pending examination requests.",
      },
      {
        label: "Medical cases",
        icon: "folder-open-outline",
        path: "/vet/medical/cases",
        description: "Active cases, treatment history, and medical records.",
      },
      {
        label: "Periodic checkups",
        icon: "calendar-outline",
        path: "/vet/medical/checkups",
        description: "Upcoming scheduled preventive visits.",
      },
      {
        label: "Medical care schedule",
        icon: "medkit-outline",
        path: "/vet/medical/care",
        description: "Prescribed treatments and care tasks.",
      },
      {
        label: "Alerts",
        icon: "notifications-outline",
        path: "/vet/alerts",
        description: "Review medical and club notifications.",
      },
      {
        label: "Supplies",
        icon: "cube-outline",
        path: "/vet/inventory",
        description: "View and manage medical supplies.",
      },
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
      { label: "Training", icon: "calendar-outline", path: "/owner/training" },
      { label: "Racing", icon: "trophy-outline", path: "/owner/racing" },
      { label: "More", icon: "ellipsis-horizontal", action: "more" },
    ],
    secondary: [
      {
        label: "Reports",
        icon: "bar-chart-outline",
        path: "/owner/reports",
        description: "Review your horse and account reports.",
      },
    ],
  },
  manager: {
    id: "manager",
    label: "Club Manager",
    person: "Clara Novak",
    scope: "Meadowline Racing Club",
    workLabel: "Training",
    nav: [
      { label: "Home", icon: "home-outline", path: "/manager" },
      { label: "Horses", icon: "grid-outline", path: "/manager/horses" },
      { label: "Training", icon: "calendar-outline", path: "/manager/training" },
      { label: "Incidents", icon: "alert-circle-outline", path: "/manager/incidents" },
      { label: "More", icon: "ellipsis-horizontal", action: "more" },
    ],
    secondary: [
      {
        label: "Stable",
        icon: "home-outline",
        path: "/manager/stable",
        description: "Overview of all barns and stalls.",
      },
      {
        label: "Supplies",
        icon: "cube-outline",
        path: "/manager/inventory",
        description: "Manage medical supplies and feed stock.",
      },
      {
        label: "Staff",
        icon: "people-outline",
        path: "/manager/staff",
        description: "View and manage club personnel.",
      },
      {
        label: "Access Control",
        icon: "shield-checkmark-outline",
        path: "/manager/access",
        description: "Configure roles, permissions, and scope.",
      },
      {
        label: "Care task types",
        icon: "list-outline",
        path: "/manager/care-task-types",
        description: "Configure the club's care task catalog.",
      },
      {
        label: "Surcharges",
        icon: "cash-outline",
        path: "/manager/surcharges",
        description: "Review and apply care surcharges.",
      },
      {
        label: "Daily fees",
        icon: "pricetag-outline",
        path: "/manager/daily-fees",
        description: "Manage daily boarding fee rates.",
      },
      {
        label: "Reports",
        icon: "bar-chart-outline",
        path: "/manager/reports",
        description: "Review club costs and owner charges.",
      },
      {
        label: "Medical overview",
        icon: "medkit-outline",
        path: "/manager/medical",
        description: "Review medical cases and checkups.",
      },
    ],
  },
};

export function isRole(value: string | string[] | undefined): value is RoleId {
  return typeof value === "string" && roleOrder.includes(value as RoleId);
}
