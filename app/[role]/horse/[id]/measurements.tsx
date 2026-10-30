import { Redirect, useLocalSearchParams } from "expo-router";
import { useCallback } from "react";
import { Screen } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { isRole, type RoleId } from "@/features/auth/roles";
import { HorseMeasurementsView } from "@/features/horses/components/HorseMeasurementsView";

export default function BodyMeasurements() {
  const { t } = useI18n();
  const { role, id } = useLocalSearchParams<{ role: string; id: string }>();
  const { token } = useAuth();

  const loadHorse = useCallback(() => horseService.get(token!, id), [id, token]);
  const horseResource = useApiResource(loadHorse, Boolean(token && id));

  if (!isRole(role)) return <Redirect href="/" />;

  return (
    <Screen
      role={role}
      title="Chỉ số cơ thể"
      subtitle={horseResource.data?.name ?? t("Horse profile")}
      back
      fallbackHref={`/${role}/horse/${id}` as any}
      refreshing={horseResource.isRefreshing}
      onRefresh={() => void horseResource.refresh()}
    >
      <HorseMeasurementsView
        horseId={id}
        roleId={role as RoleId}
        onUpdated={() => void horseResource.refresh()}
      />
    </Screen>
  );
}
