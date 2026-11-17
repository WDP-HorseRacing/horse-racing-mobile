import { Redirect, type Href } from "expo-router";
import { GroomStableScreen } from "@/features/stable-care/screens/GroomStableScreen";
import { useAuth } from "@/context/AuthContext";

export default function GroomStableRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "groom") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <GroomStableScreen />;
}
