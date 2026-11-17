import { Redirect, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import type { RoleId } from "@/lib/raceos-data";
import {
  Chips,
  Panel,
  getUiStyles,
} from "@/components/ui";
import { TimelineItem, Screen, SectionTitle } from "@/components/common";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import { isRole } from "@/features/auth/roles";
import { useTheme } from "@/hooks/useTheme";
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
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);
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
    mockHorse,
    plan,
    nextSession,
    locked,
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
  if (isUuidId && !horseResource.data) {
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
      )} · ${t(horseResource.data ? "Club profile" : "Demo profile")}`}
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
      <HorsePassportHeader horse={horse} horseResource={horseResource} photoResource={photoResource} />
      <Chips options={tabs} value={visibleTab} onChange={setTab} />

      {visibleTab === "Overview" ? (
        <HorseOverviewTab
          horseId={id}
          roleId={roleId}
          isRealData={Boolean(horseResource.data)}
          horseData={horseResource.data}
          mockHorse={mockHorse}
          token={token}
          pedigreeResource={pedigreeResource}
          permissionsResource={permissionsResource}
          onHorseRefresh={horseResource.refresh}
          onSelectTab={setTab}
        />
      ) : null}

      {visibleTab === "Training" ? (
        <HorseTrainingTab
          trainingResource={trainingResource}
          roleId={roleId}
          horseLifecycleStatus={horseResource.data?.lifecycleStatus}
          isUuidId={isUuidId}
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
          isRealData={Boolean(horseResource.data)}
          horseData={horseResource.data}
          mockHorse={mockHorse}
          locked={locked}
          plan={plan}
          nextSession={nextSession}
          token={token}
          medicalResource={medicalResource}
          careResource={careResource}
          permissionsResource={permissionsResource}
          onHorseRefresh={horseResource.refresh}
        />
      ) : null}

      {visibleTab === "Performance" ? (
        <HorsePerformanceTab
          isRealData={Boolean(horseResource.data)}
          performanceResource={performanceResource}
        />
      ) : null}

      {visibleTab === "Costs" ? (
        <HorseCostsTab
          horseId={id}
          roleId={roleId}
          isRealData={Boolean(horseResource.data)}
          medicalResource={medicalResource}
          surchargesResource={surchargesResource}
        />
      ) : null}

      {visibleTab === "Timeline" && !horseResource.data ? (
        <View style={uiStyles.section}>
          <SectionTitle>Timeline</SectionTitle>
          <Panel>
            <TimelineItem
              time="10:41"
              title="Trainer published recovery plan"
              detail="800 m · 50% · light · soft surface"
              tone={colors.primary}
            />
            <TimelineItem
              time="10:24"
              title="Training locked by veterinarian"
              detail="Abnormal heart-rate response"
              tone={colors.destructive}
            />
            <TimelineItem
              time="10:06"
              title="System raised HR alert"
              detail="188 bpm sustained 42 s"
              tone={colors.training}
            />
            <TimelineItem
              time="06:20"
              title="Training session executed"
              detail="1,600 m · moderate · dirt"
            />
            <TimelineItem
              time="06:00"
              title="Groom completed preparation"
              detail="Sensor vest fitted by Mai Tran"
              last
            />
          </Panel>
        </View>
      ) : null}

      {visibleTab === "Timeline" && roleId === "manager" && horseResource.data ? (
        <HorseTimelineTab auditResource={auditResource} />
      ) : null}
    </Screen>
  );
}

export default HorseDetailScreen;
