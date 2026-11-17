import { Redirect, type Href } from "expo-router";
import { ManagerOperationsScreen } from "@/features/dashboard/screens/ManagerOperationsScreen";
import { useAuth } from "@/context/AuthContext";

export default function OperationsRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "manager") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <ManagerOperationsScreen />;
}
