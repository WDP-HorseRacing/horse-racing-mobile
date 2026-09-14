import type { RoleId } from "./raceos-data";

export type NavItem = { label: string; to: string; icon: string };

export type RoleConfig = {
  id: RoleId;
  label: string;
  person: string;
  initials: string;
  scope: string;
  home: string;
  nav: NavItem[];
  modules: string[];
};

export const roles: Record<RoleId, RoleConfig> = {
  trainer: {
    id: "trainer",
    label: "Head Trainer",
    person: "Elena Marsh",
    initials: "EM",
    scope: "24 horses · Meadowline Stable",
    home: "/trainer",
    nav: [
      { label: "Home", to: "/trainer", icon: "home" },
      { label: "Horses", to: "/trainer/horses", icon: "horse" },
      { label: "Training", to: "/trainer/training", icon: "training" },
      { label: "Alerts", to: "/trainer/alerts", icon: "alert" },
      { label: "Profile", to: "/profile", icon: "profile" },
    ],
    modules: ["Dashboard", "Horses", "Training", "Live Training", "Performance", "Racing", "Notifications"],
  },
  groom: {
    id: "groom",
    label: "Groom",
    person: "Mai Tran",
    initials: "MT",
    scope: "A wing · 8 horses",
    home: "/groom",
    nav: [
      { label: "Home", to: "/groom", icon: "home" },
      { label: "Tasks", to: "/groom/tasks", icon: "task" },
      { label: "Stable", to: "/groom/stable", icon: "stable" },
      { label: "Report", to: "/groom/report", icon: "report" },
      { label: "Profile", to: "/profile", icon: "profile" },
    ],
    modules: ["Tasks", "Stable Map", "Feeding", "Incidents", "Horses (read)"],
  },
  vet: {
    id: "vet",
    label: "Veterinarian",
    person: "Dr. Sanjay Rao",
    initials: "SR",
    scope: "Medical authority · club-wide",
    home: "/vet",
    nav: [
      { label: "Home", to: "/vet", icon: "home" },
      { label: "Horses", to: "/vet/horses", icon: "horse" },
      { label: "Medical", to: "/vet/medical", icon: "medical" },
      { label: "Alerts", to: "/vet/alerts", icon: "alert" },
      { label: "Profile", to: "/profile", icon: "profile" },
    ],
    modules: ["Health", "Medical Records", "Injuries", "Treatment", "Vaccination", "Training Lock"],
  },
  owner: {
    id: "owner",
    label: "Horse Owner",
    person: "Marlow Bloodstock",
    initials: "MB",
    scope: "3 horses owned",
    home: "/owner",
    nav: [
      { label: "Home", to: "/owner", icon: "home" },
      { label: "Horses", to: "/owner/horses", icon: "horse" },
      { label: "Racing", to: "/owner/racing", icon: "race" },
      { label: "Reports", to: "/owner/reports", icon: "report" },
      { label: "Profile", to: "/profile", icon: "profile" },
    ],
    modules: ["My Horses", "Health summary", "Performance", "Racing", "Reports & costs"],
  },
  manager: {
    id: "manager",
    label: "Club Manager",
    person: "Clara Novak",
    initials: "CN",
    scope: "Meadowline Racing Club",
    home: "/manager",
    nav: [
      { label: "Home", to: "/manager", icon: "home" },
      { label: "Horses", to: "/manager/horses", icon: "horse" },
      { label: "Operations", to: "/manager/operations", icon: "ops" },
      { label: "Reports", to: "/manager/reports", icon: "report" },
      { label: "Profile", to: "/profile", icon: "profile" },
    ],
    modules: ["KPIs", "Horses", "Stable", "Inventory", "Staff & RBAC", "Finance", "Reports", "Audit Logs"],
  },
};

export const roleList = Object.values(roles);
