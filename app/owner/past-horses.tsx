import { Redirect, type Href } from "expo-router";
import PastHorsesScreen from "@/features/horses/screens/PastHorsesScreen";
import { useAuth } from "@/context/AuthContext";

export default function PastHorsesRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "owner") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <PastHorsesScreen />;
}
