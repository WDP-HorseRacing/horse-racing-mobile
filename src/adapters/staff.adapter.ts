export type StaffRole =
  | "HEAD_TRAINER"
  | "VETERINARIAN"
  | "GROOM"
  | "HORSE_OWNER"
  | "CLUB_MANAGER";

export type StaffStatus = "ACTIVE" | "LOCKED" | "INACTIVE";

export type StaffDto = {
  id: string;
  fullName: string;
  email: string;
  role: StaffRole | null;
  status: StaffStatus;
};

export type StaffView = StaffDto & { roleLabel: string; statusLabel: string };

export const STAFF_ROLE_OPTIONS = [
  "Head Trainer", "Veterinarian", "Groom", "Horse Owner", "Manager",
] as const;

export function mapStaffMember(staff: StaffDto): StaffView {
  return {
    ...staff,
    roleLabel: staff.role ? staffRoleLabel(staff.role) : "No role",
    statusLabel: staffStatusLabel(staff.status),
  };
}

export function staffRoleFromLabel(label: string): StaffRole {
  switch (label) {
    case "Head Trainer": return "HEAD_TRAINER";
    case "Veterinarian": return "VETERINARIAN";
    case "Horse Owner": return "HORSE_OWNER";
    case "Manager": return "CLUB_MANAGER";
    default: return "GROOM";
  }
}

export function staffRoleLabel(role: StaffRole): string {
  switch (role) {
    case "HEAD_TRAINER": return "Head Trainer";
    case "VETERINARIAN": return "Veterinarian";
    case "HORSE_OWNER": return "Horse Owner";
    case "CLUB_MANAGER": return "Manager";
    case "GROOM": return "Groom";
  }
}

export function staffStatusLabel(status: StaffStatus): string {
  switch (status) {
    case "ACTIVE": return "Active";
    case "LOCKED": return "Locked";
    case "INACTIVE": return "Inactive";
  }
}
