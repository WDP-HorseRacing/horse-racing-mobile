import { Redirect, useLocalSearchParams } from "expo-router";
import { isRole } from "@/features/auth/roles";
import { NotificationsFeed } from "@/features/notifications/components/NotificationsFeed";

export default function Notifications() {
  const { role } = useLocalSearchParams<{ role: string }>();
  if (!isRole(role)) return <Redirect href="/" />;
  return <NotificationsFeed role={role} />;
}
