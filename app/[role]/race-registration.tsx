import { type Href, Redirect, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import { useI18n } from "@/context/I18nContext";
import { races, type RaceAptitude, type RoleId } from "@/lib/raceos-data";
import { Chips , Panel, PrimaryButton, getUiStyles } from "@/components/ui";
import { KeyValue , Screen, SectionTitle } from "@/components/common";
import { isRole, roles } from "@/features/auth/roles";
import { useTheme } from "@/hooks/useTheme";

const allowedRoles: RoleId[] = ["trainer", "manager", "owner"];

export default function RaceRegistration() {
    const { colors } = useTheme();
    const uiStyles = getUiStyles(colors);
  const { role } = useLocalSearchParams<{ role: string }>();
  const { horses, raceRegistrations, registerRace } = useRaceOS();
  const { t } = useI18n();
  const [horseId, setHorseId] = useState("");
  const [raceId, setRaceId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  if (!isRole(role)) return <Redirect href="/" />;
  if (!allowedRoles.includes(role)) return <Redirect href={`/${role}` as Href} />;

  const ownerName = roles.owner.person;
  const eligible = horses.filter(
    (horse) =>
      (horse.status === "RACE READY" || horse.status === "FIT") &&
      (role !== "owner" || horse.owner === ownerName),
  );
  const horse = eligible.find((item) => item.id === horseId);
  const race = races.find((item) => item.id === raceId);
  const expectedAptitude = race ? aptitudeForDistance(race.distanceM) : null;
  const matches = Boolean(horse && expectedAptitude && horse.raceAptitude === expectedAptitude);
  const duplicate = Boolean(
    horse &&
    race &&
    raceRegistrations.some((item) => item.horseId === horse.id && item.raceId === race.id),
  );

  const submit = () => {
    if (!horse || !race || duplicate) return;
    registerRace({
      id: `registration-${horse.id}-${race.id}`,
      horseId: horse.id,
      raceId: race.id,
      submittedByRole: role,
      status: "submitted",
      createdAt: new Date().toISOString(),
    });
    setSubmitted(true);
    Alert.alert(t("Registration submitted"), `${horse.name} · ${race.name}`, [
      { text: t("Done"), onPress: () => router.back() },
    ]);
  };

  return (
    <Screen role={role} title="Race registration" subtitle="Eligibility and aptitude check" back>
      {submitted ? (
        <Panel>
          <Text style={{ ...uiStyles.value, color: colors.primary }}>
            {t("Registration submitted successfully.")}
          </Text>
        </Panel>
      ) : null}
      <View style={uiStyles.section}>
        <SectionTitle>Select horse</SectionTitle>
        {eligible.length ? (
          <Chips
            options={eligible.map((item) => item.name)}
            value={horse?.name ?? ""}
            onChange={(name) => {
              setHorseId(eligible.find((item) => item.name === name)?.id ?? "");
              setSubmitted(false);
            }}
          />
        ) : (
          <Panel>
            <Text style={uiStyles.muted}>{t("No eligible race-ready horses available.")}</Text>
          </Panel>
        )}
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Select race</SectionTitle>
        <Chips
          options={races.map((item) => item.name)}
          value={race?.name ?? ""}
          onChange={(name) => {
            setRaceId(races.find((item) => item.name === name)?.id ?? "");
            setSubmitted(false);
          }}
        />
      </View>
      <Panel>
        <KeyValue
          items={[
            [t("Horse"), horse?.name ?? "—"],
            [t("Fitness"), `${horse?.fitness ?? 0}%`],
            [t("Aptitude"), horse?.raceAptitude ?? "—"],
            [t("Race"), race?.name ?? "—"],
            [t("Distance"), race ? `${race.distanceM.toLocaleString()} m` : "—"],
            [
              t("Status"),
              !horse || !race
                ? t("Select horse and race")
                : duplicate
                  ? t("Already registered")
                  : matches
                    ? t("Perfect match")
                    : t("Aptitude warning"),
            ],
          ]}
        />
      </Panel>
      {horse && race && !matches ? (
        <Panel>
          <Text style={{ ...uiStyles.muted, color: colors.monitor }}>
            {t("Performance may be suboptimal.")} {horse.raceAptitude} → {expectedAptitude}
          </Text>
        </Panel>
      ) : null}
      {duplicate ? (
        <Panel>
          <Text style={{ ...uiStyles.muted, color: colors.monitor }}>
            {t("This horse is already registered for this race.")}
          </Text>
        </Panel>
      ) : null}
      <PrimaryButton
        label={duplicate ? "Already registered" : "Submit registration"}
        icon="flag"
        onPress={submit}
        disabled={!horse || !race || duplicate}
      />
    </Screen>
  );
}

function aptitudeForDistance(distance: number): RaceAptitude {
  if (distance <= 1400) return "SPRINTER";
  if (distance <= 1800) return "MILER";
  return "STAYER";
}
