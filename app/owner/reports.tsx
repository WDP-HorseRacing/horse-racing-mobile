import { Redirect, type Href } from "expo-router";
import { OwnerReportsScreen } from "@/features/reports/screens/OwnerReportsScreen";
import { useAuth } from "@/context/AuthContext";

export default function OwnerReportsRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "owner") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <OwnerReportsScreen />;
}
