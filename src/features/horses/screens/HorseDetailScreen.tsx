import { Redirect, useLocalSearchParams } from "expo-router";
import type { RoleId } from "@/types/raceos";
import { Chips } from "@/components/ui";
import { Screen } from "@/components/common";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { isRole } from "@/features/auth/roles";
import { useI18n } from "@/context/I18nContext";
import { HorseTimelineTab } from "@/features/horses/components/tabs/HorseTimelineTab";
import { HorseTrainingTab } from "@/features/horses/components/tabs/HorseTrainingTab";
import { HorseNutritionTab } from "@/features/horses/components/tabs/HorseNutritionTab";
import { HorseCostsTab } from "@/features/horses/components/tabs/HorseCostsTab";
import { HorsePerformanceTab } from "@/features/horses/components/tabs/HorsePerformanceTab";
import { HorseMedicalTab } from "@/features/horses/components/tabs/HorseMedicalTab";
import { HorseInjuriesTab } from "@/features/horses/components/tabs/HorseInjuriesTab";
import { HorseOverviewTab } from "@/features/horses/components/tabs/HorseOverviewTab";
import { HorsePassportHeader } from "@/features/horses/components/HorsePassportHeader";
import { useHorseDetailData } from "@/features/horses/hooks/useHorseDetailData";

export function HorseDetailScreen() {
  const { t } = useI18n();
  const {
    role,
    id,
    tab: requestedTab,
  } = useLocalSearchParams<{ role: string; id: string; tab?: string }>();
  const roleId: RoleId = isRole(role) ? role : "trainer";
  const requestedTabValue = Array.isArray(requestedTab) ? requestedTab[0] : requestedTab;
  const {
    token,
    tab,
    setTab,
    tabs,
    visibleTab,
    isUuidId,
    horse,
    horseResource,
    permissionsResource,
    pedigreeResource,
    photoResource,
    trainingResource,
    medicalResource,
    surchargesResource,
    performanceResource,
    careResource,
    auditResource,
  } = useHorseDetailData({ id, roleId, requestedTabValue });
  if (!isRole(role)) return <Redirect href="/" />;
  if (!isUuidId) return <Redirect href={`/${roleId}/horses` as any} />;
  if (!horseResource.data || !horse) {
    return (
      <Screen
        role={roleId}
        title="Horse profile"
        back
        fallbackHref={`/${roleId}/horses` as any}
        refreshing={
          horseResource.isRefreshing ||
          trainingResource.isRefreshing ||
          permissionsResource.isRefreshing
        }
        onRefresh={() =>
          void Promise.all([
            horseResource.refresh(),
            trainingResource.refresh(),
            permissionsResource.refresh(),
          ])
        }
      >
        <AsyncStateView
          isLoading={horseResource.isLoading}
          error={horseResource.error}
          onRetry={() => void horseResource.retry()}
        />
      </Screen>
    );
  }
  return (
    <Screen
      role={roleId}
      title={horse.name}
      subtitle={`${t(
        (
          {
            manager: "Manager",
            trainer: "Trainer",
            vet: "Vet",
            groom: "Groom",
            owner: "Owner",
          } as const
        )[roleId],
      )} · ${t("Club profile")}`}
      back
      fallbackHref={`/${roleId}/horses` as any}
      refreshing={
        horseResource.isRefreshing ||
        trainingResource.isRefreshing ||
        permissionsResource.isRefreshing ||
        medicalResource.isRefreshing ||
        performanceResource.isRefreshing ||
        careResource.isRefreshing
      }
      onRefresh={() =>
        void Promise.all([
          horseResource.refresh(),
          trainingResource.refresh(),
          permissionsResource.refresh(),
          medicalResource.refresh(),
          performanceResource.refresh(),
          careResource.refresh(),
        ])
      }
    >
      <AsyncStateView
        isLoading={false}
        error={horseResource.error}
        onRetry={() => void horseResource.retry()}
      />
      <AsyncStateView
        isLoading={false}
        error={permissionsResource.error}
        onRetry={() => void permissionsResource.retry()}
      />
      <HorsePassportHeader horse={horse} photoResource={photoResource} />
      <Chips options={tabs} value={visibleTab} onChange={setTab} />

      {visibleTab === "Overview" ? (
        <HorseOverviewTab
          roleId={roleId}
          horseData={horseResource.data}
          token={token}
          pedigreeResource={pedigreeResource}
          permissionsResource={permissionsResource}
          onHorseRefresh={horseResource.refresh}
        />
      ) : null}

      {visibleTab === "Training" ? (
        <HorseTrainingTab
          trainingResource={trainingResource}
          roleId={roleId}
          horseLifecycleStatus={horseResource.data?.lifecycleStatus}
        />
      ) : null}

      {(visibleTab === "Nutrition" || (roleId === "groom" && visibleTab === "Care")) && horseResource.data ? (
        <HorseNutritionTab
          horseId={horse.id}
          roleId={roleId}
          surchargesResource={surchargesResource}
        />
      ) : null}

      {visibleTab === "Injuries" ? (
        <HorseInjuriesTab roleId={roleId} medicalResource={medicalResource} />
      ) : null}

      {["Care", "Health", "Medical", "Treatment"].includes(visibleTab) &&
      (roleId !== "groom" || visibleTab !== "Care" || !horseResource.data) ? (
        <HorseMedicalTab
          tab={visibleTab}
          horseId={id}
          roleId={roleId}
          horseData={horseResource.data}
          token={token}
          medicalResource={medicalResource}
          careResource={careResource}
          permissionsResource={permissionsResource}
          onHorseRefresh={horseResource.refresh}
        />
      ) : null}

      {visibleTab === "Performance" ? (
        <HorsePerformanceTab
          performanceResource={performanceResource}
        />
      ) : null}

      {visibleTab === "Costs" ? (
        <HorseCostsTab
          horseId={id}
          roleId={roleId}
          medicalResource={medicalResource}
          surchargesResource={surchargesResource}
        />
      ) : null}

      {visibleTab === "Timeline" && roleId === "manager" ? (
        <HorseTimelineTab auditResource={auditResource} />
      ) : null}
    </Screen>
  );
}

export default HorseDetailScreen;
