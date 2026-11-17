import { Redirect, type Href } from "expo-router";
import { RegisterHorseScreen } from "@/features/horses/screens/RegisterHorseScreen";
import { useAuth } from "@/context/AuthContext";

export default function RegisterHorseRoute() {
  const { role, isLoading } = useAuth();

  if (!isLoading && role !== "manager") {
    return <Redirect href={role ? (`/${role}` as Href) : "/login"} />;
  }

  return <RegisterHorseScreen />;
}
