import { Redirect, type Href } from "expo-router";
import { DailyFeesScreen } from "@/features/billing/screens/DailyFeesScreen";
import { useAuth } from "@/context/AuthContext";

export default function DailyFeesRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "manager") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <DailyFeesScreen />;
}
