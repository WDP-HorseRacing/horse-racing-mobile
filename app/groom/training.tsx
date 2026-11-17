import { Redirect, type Href } from "expo-router";
import { GroomTrainingPrepScreen } from "@/features/training/screens/GroomTrainingPrepScreen";
import { useAuth } from "@/context/AuthContext";

export default function GroomTrainingRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "groom") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <GroomTrainingPrepScreen />;
}
