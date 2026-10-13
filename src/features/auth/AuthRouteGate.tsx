import { useEffect, type PropsWithChildren } from "react";
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
    if (redirectPath) router.replace(redirectPath as Href);
  }, [redirectPath]);

  if (isLoading) return <LoadingScreen label="Checking your session…" />;
  if (redirectPath) return <LoadingScreen label="Opening your workspace…" />;
  return children;
}

function roleForPath(pathname: string): RoleId | null {
  const [, first, second] = pathname.split("/");
  if (roleOrder.includes(first as RoleId)) return first as RoleId;
  if (first === "profile" && roleOrder.includes(second as RoleId)) return second as RoleId;
  return null;
}
