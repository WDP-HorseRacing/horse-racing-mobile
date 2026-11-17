import { Redirect, type Href } from "expo-router";
import { TrainerTrainingScreen } from "@/features/training/screens/TrainerTrainingScreen";
import { useAuth } from "@/context/AuthContext";

export default function TrainerTrainingRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "trainer") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <TrainerTrainingScreen />;
}
