import { Redirect, type Href } from "expo-router";
import { GroomTasksScreen } from "@/features/tasks/screens/GroomTasksScreen";
import { useAuth } from "@/context/AuthContext";

export default function GroomTasksRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "groom") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <GroomTasksScreen />;
}
