import { Redirect, useLocalSearchParams } from "expo-router";
import { isRole } from "@/features/auth/roles";
import { HorseAlertsFeed } from "@/features/alerts/components/HorseAlertsFeed";

export default function Alerts() {
  const { role } = useLocalSearchParams<{ role: string }>();
  if (!isRole(role)) return <Redirect href="/" />;
  return <HorseAlertsFeed role={role} />;
}
