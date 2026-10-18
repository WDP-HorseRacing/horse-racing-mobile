import { Redirect, useLocalSearchParams } from "expo-router";
import { SuppliesScreen } from "@/features/stable-care/SuppliesScreen";
import { isRole } from "@/features/auth/roles";
import { useAuth } from "@/context/AuthContext";

export default function RoleInventory() {
  const { role: roleParam } = useLocalSearchParams<{ role: string }>();
  const { role } = useAuth();
  if (!isRole(roleParam) || roleParam === "owner" || roleParam !== role)
    return <Redirect href="/" />;
  return <SuppliesScreen role={roleParam} />;
}
