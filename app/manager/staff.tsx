import { Redirect, type Href } from "expo-router";
import { ManagerStaffScreen } from "@/features/auth/screens/ManagerStaffScreen";
import { useAuth } from "@/context/AuthContext";

export default function ManagerStaffRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "manager") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <ManagerStaffScreen />;
}
