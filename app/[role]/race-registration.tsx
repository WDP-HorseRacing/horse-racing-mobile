import { type Href, Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import type { RoleId } from "@/lib/raceos-data";
import { Chips, Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { AsyncStateView, Screen, SectionTitle } from "@/components/common";
import { isRole } from "@/features/auth/roles";
import { useTheme } from "@/hooks/useTheme";
import { useApiResource } from "@/hooks/useApiResource";
import { horseService } from "@/services/horse.service";
import { racingService } from "@/services/racing.service";
import { extractErrorMessage } from "@/utils/errorHandler";

const allowedRoles: RoleId[] = ["trainer", "manager", "owner"];

export default function RaceRegistration() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { role } = useLocalSearchParams<{ role: string }>();
  const { token } = useAuth();
  const { t } = useI18n();
  const [horseId, setHorseId] = useState("");
  const [raceId, setRaceId] = useState("");
  const [saving, setSaving] = useState(false);
  const loadHorses = useCallback(() => horseService.list(token!), [token]);
  const loadRaces = useCallback(() => racingService.listRaces(token!), [token]);
  const horsesResource = useApiResource(loadHorses, Boolean(token));
  const racesResource = useApiResource(loadRaces, Boolean(token));
  if (!isRole(role)) return <Redirect href="/" />;
  if (!allowedRoles.includes(role)) return <Redirect href={`/${role}` as Href} />;

  const horses = (horsesResource.data ?? []).filter((horse) => horse.canRegisterRace);
  const horse = horses.find((item) => item.id === horseId);
  const races = racesResource.data ?? [];
  const race = races.find((item) => item.id === raceId);
  const submit = async () => {
    if (!token || !horse || !race) return;
    setSaving(true);
    try {
      await racingService.registerHorse(token, race.id, horse.id);
      Alert.alert(t("Registration submitted"), `${horse.name} · ${race.name}`, [
        { text: t("Done"), onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(t("Registration failed"), extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen role={role} title="Race registration" subtitle="Server eligibility and race selection" back refreshing={horsesResource.isRefreshing || racesResource.isRefreshing} onRefresh={() => { void horsesResource.refresh(); void racesResource.refresh(); }}>
      <View style={uiStyles.section}>
        <SectionTitle>Select horse</SectionTitle>
        <AsyncStateView isLoading={horsesResource.isLoading} error={horsesResource.error} onRetry={() => void horsesResource.retry()} empty={!horsesResource.isLoading && !horsesResource.error && horses.length === 0} emptyLabel="No horses eligible for race registration." />
        {horses.length ? <Chips options={horses.map((item) => `${item.name} · ${item.id.slice(0, 6)}`)} value={horse ? `${horse.name} · ${horse.id.slice(0, 6)}` : ""} onChange={(value) => setHorseId(horses.find((item) => `${item.name} · ${item.id.slice(0, 6)}` === value)?.id ?? "")} /> : null}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Select race</SectionTitle>
        <AsyncStateView isLoading={racesResource.isLoading} error={racesResource.error} onRetry={() => void racesResource.retry()} empty={!racesResource.isLoading && !racesResource.error && races.length === 0} emptyLabel="No races are available." />
        {races.length ? <Chips options={races.map((item) => `${item.name} · ${item.id.slice(0, 6)}`)} value={race ? `${race.name} · ${race.id.slice(0, 6)}` : ""} onChange={(value) => setRaceId(races.find((item) => `${item.name} · ${item.id.slice(0, 6)}` === value)?.id ?? "")} /> : null}
      </View>
      {horse || race ? <Panel><Text style={uiStyles.value}>{t("Registration details")}</Text><Text style={uiStyles.muted}>{t("Horse")}: {horse?.name ?? "—"}</Text><Text style={uiStyles.muted}>{t("Race")}: {race?.name ?? "—"}</Text></Panel> : null}
      <PrimaryButton label={saving ? "Submitting…" : "Submit registration"} icon="flag" onPress={() => void submit()} disabled={!horse || !race || saving} />
    </Screen>
  );
}
