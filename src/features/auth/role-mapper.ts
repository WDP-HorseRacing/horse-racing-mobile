import type { RoleId } from "@/types/raceos";

const backendRoleToAppRole: Record<string, RoleId> = {
  HEAD_TRAINER: "trainer",
  GROOM: "groom",
  VETERINARIAN: "vet",
  HORSE_OWNER: "owner",
  CLUB_MANAGER: "manager",
};

export function appRoleFromAuthRoles(roles: readonly string[]): RoleId | null {
  for (const backendRole of roles) {
    const appRole = backendRoleToAppRole[backendRole.toUpperCase()];
    if (appRole) return appRole;
  }
  return null;
}
