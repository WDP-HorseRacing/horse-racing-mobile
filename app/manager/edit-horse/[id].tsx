import { Redirect, type Href } from "expo-router";
import { EditHorseScreen } from "@/features/horses/screens/EditHorseScreen";
import { useAuth } from "@/context/AuthContext";

export default function EditHorseRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "manager") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <EditHorseScreen />;
}
