import { Redirect, type Href } from "expo-router";
import { ManagerReportsScreen } from "@/features/reports/screens/ManagerReportsScreen";
import { useAuth } from "@/context/AuthContext";

export default function ManagerReportsRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "manager") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <ManagerReportsScreen />;
}
