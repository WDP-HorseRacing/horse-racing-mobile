import { Redirect, useLocalSearchParams, type Href } from "expo-router";
import { useCallback } from "react";
import { isRole, roles } from "@/features/auth/roles";
import { RoleDashboard, type DashboardPayload } from "@/features/dashboard/components/RoleDashboard";
import { Screen } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { horseService } from "@/services/horse.service";
import { trainingService } from "@/services/training.service";
import { groomService } from "@/services/groom.service";
import { medicalService } from "@/services/medical.service";
import { mapHorseSummary } from "@/adapters/horse.adapter";

export default function RoleHome() {
  const { role } = useLocalSearchParams<{ role: string }>();
  const auth = useAuth();
  const roleId = isRole(role) ? role : "trainer";
  const loadDashboard = useCallback(async (): Promise<DashboardPayload> => {
    const token = auth.token!;
    if (roleId === "trainer") {
      return { kind: "training", sessions: await trainingService.listAllVisibleSessions(token) };
    }
    if (roleId === "groom") {
      return { kind: "groom", today: await groomService.getToday(token) };
    }
    if (roleId === "vet") {
      return { kind: "medical", dashboard: await medicalService.getDashboard(token) };
    }
    const horses = await horseService.list(token);
    return { kind: "horses", horses: horses.map(mapHorseSummary) };
  }, [auth.token, roleId]);
  const resource = useApiResource(loadDashboard, Boolean(auth.token) && isRole(role));
  useRefreshOnFocus(resource.refresh);
  if (!isRole(role)) return <Redirect href="/" />;
  if (auth.role !== role) return <Redirect href={(auth.role ? `/${auth.role}` : "/login") as Href} />;
  const firstName = auth.user?.fullName.split(" ")[0] ?? "there";
  const title =
    role === "trainer"
      ? `Good morning, ${firstName}`
      : role === "groom"
        ? `Good morning, ${firstName}`
        : role === "owner"
          ? "My horses"
          : role === "vet"
            ? "Health overview"
            : "Club overview";
  return (
    <Screen
      role={role}
      title={title}
      subtitle={auth.user?.email ?? roles[role].scope}
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      {resource.data ? (
        <RoleDashboard
          role={role}
          payload={resource.data}
          token={auth.token!}
          onRefresh={resource.refresh}
        />
      ) : null}
    </Screen>
  );
}
