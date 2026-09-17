import { Redirect, useLocalSearchParams } from "expo-router";
import { isRole, roles } from "@/native/roles";
import { RoleDashboard } from "@/native/home-screens";
import { Screen } from "@/native/ui";

export default function RoleHome() {
  const { role } = useLocalSearchParams<{ role: string }>();
  if (!isRole(role)) return <Redirect href="/" />;
  const title =
    role === "trainer"
      ? "Good morning, Elena"
      : role === "groom"
        ? "Good morning, Mai"
        : role === "owner"
          ? "My horses"
          : role === "vet"
            ? "Health overview"
            : "Club overview";
  return (
    <Screen role={role} title={title} subtitle={roles[role].scope}>
      <RoleDashboard role={role} />
    </Screen>
  );
}
