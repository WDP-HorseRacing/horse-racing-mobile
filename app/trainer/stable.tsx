import { Redirect, type Href } from "expo-router";
import { StableManagementScreen } from "@/features/stable-care/StableManagementScreen";
import { useAuth } from "@/context/AuthContext";

export default function TrainerStable() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "trainer") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <StableManagementScreen role="trainer" />;
}
