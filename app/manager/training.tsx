import { Redirect, type Href } from "expo-router";
import { ManagerTrainingScreen } from "@/features/training/screens/ManagerTrainingScreen";
import { useAuth } from "@/context/AuthContext";

export default function ManagerTrainingRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "manager") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <ManagerTrainingScreen />;
}
