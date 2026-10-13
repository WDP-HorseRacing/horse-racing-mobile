import { Redirect, type Href } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/common/LoadingScreen";

export default function Index() {
  const { isAuthenticated, isLoading, role } = useAuth();
  if (isLoading) return <LoadingScreen label="Checking your session…" />;
  return <Redirect href={(isAuthenticated && role ? `/${role}` : "/login") as Href} />;
}
