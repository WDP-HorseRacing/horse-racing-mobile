import type { RoleId } from "@/lib/raceos-data";
import { TrainerDashboard } from "./TrainerDashboard";
import { GroomDashboard } from "./GroomDashboard";
import { VetDashboard } from "./VetDashboard";
import { OwnerDashboard } from "./OwnerDashboard";
import { ManagerDashboard } from "./ManagerDashboard";

export function RoleDashboard({ role }: { role: RoleId }) {
  if (role === "trainer") return <TrainerDashboard />;
  if (role === "groom") return <GroomDashboard />;
  if (role === "vet") return <VetDashboard />;
  if (role === "owner") return <OwnerDashboard />;
  return <ManagerDashboard />;
}
