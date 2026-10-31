import { useEffect, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { router, usePathname, type Href } from "expo-router";
import { roleOrder } from "@/features/auth/roles";
import { useAuth } from "@/context/AuthContext";
import { LoadingScreen } from "@/components/common/LoadingScreen";
import type { RoleId } from "@/types/raceos";

export function AuthRouteGate({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const { isAuthenticated, isLoading, role } = useAuth();
  const pathRole = roleForPath(pathname);

  let redirectPath: string | null = null;
  if (!isLoading) {
    if (!isAuthenticated || !role) {
      if (pathRole || pathname === "/" || pathname === "/login") {
        redirectPath = pathname === "/login" ? null : "/login";
      }
    } else if (pathname === "/" || pathname === "/login") {
      redirectPath = `/${role}`;
    } else if (pathRole && pathRole !== role) {
      redirectPath = `/${role}`;
    }
  }

  useEffect(() => {
    if (redirectPath) {
      router.replace(redirectPath as Href);
    }
  }, [redirectPath]);

  return (
    <View style={styles.container}>
      {children}
      {isLoading ? (
        <View style={StyleSheet.absoluteFill}>
          <LoadingScreen label="Checking your session…" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

function roleForPath(pathname: string): RoleId | null {
  const [, first, second] = pathname.split("/");
  if (roleOrder.includes(first as RoleId)) return first as RoleId;
  if (first === "profile" && roleOrder.includes(second as RoleId)) return second as RoleId;
  return null;
}
