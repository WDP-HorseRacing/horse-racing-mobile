import { Redirect, type Href } from "expo-router";
import { AccessControlScreen } from "@/features/auth/screens/AccessControlScreen";
import { useAuth } from "@/context/AuthContext";

export default function AccessControlRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "manager") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <AccessControlScreen />;
}
