import { Redirect, type Href } from "expo-router";
import { OwnerTrainingProgressScreen } from "@/features/training/screens/OwnerTrainingProgressScreen";
import { useAuth } from "@/context/AuthContext";

export default function OwnerTrainingRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "owner") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <OwnerTrainingProgressScreen />;
}
