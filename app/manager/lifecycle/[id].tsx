import { Redirect, type Href } from "expo-router";
import { HorseLifecycleScreen } from "@/features/horses/screens/HorseLifecycleScreen";
import { useAuth } from "@/context/AuthContext";

export default function LifecycleRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "manager") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <HorseLifecycleScreen />;
}
