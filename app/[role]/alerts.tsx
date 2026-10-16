import { Redirect, useLocalSearchParams } from "expo-router";
import { isRole } from "@/features/auth/roles";
import { NotificationsFeed } from "@/features/alerts/components/NotificationsFeed";

export default function Alerts() {
  const { role } = useLocalSearchParams<{ role: string }>();
  if (!isRole(role)) return <Redirect href="/" />;
  return <NotificationsFeed role={role} />;
}
