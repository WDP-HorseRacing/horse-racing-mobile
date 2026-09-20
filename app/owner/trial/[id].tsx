import { useLocalSearchParams } from "expo-router";
import { View, StyleSheet, Dimensions } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { useRaceOS } from "@/context/RaceOSContext";
import { Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { radius, space } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { useVideoPlayer, VideoView } from "expo-video";
import { Link } from "expo-router";

export default function OwnerTrialDetail() {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const uiStyles = getUiStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  
  const { trials, horses, trainerRemarks } = useRaceOS();
  const trial = trials?.find((t) => t.id === id);
  const horse = horses.find((h) => h.id === trial?.horseId);
  const remark = trainerRemarks?.find((r) => r.trialId === id);

  const player = useVideoPlayer(trial?.videoUrl || "", (player) => {
    player.loop = true;
    player.play();
  });

  if (!trial || !horse) {
    return (
      <Screen role="owner" title="Trial unavailable" back>
        <Panel>
          <Text style={uiStyles.muted}>This trial video could not be found.</Text>
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen
      role="owner"
      title="Trial Video"
      subtitle={`${horse.name} · ${trial.date}`}
      back
    >
      <View style={styles.videoContainer}>
        {trial.videoUrl ? (
          <VideoView
            style={styles.video}
            player={player}
          />
        ) : (
          <View style={[styles.video, styles.noVideo]}>
            <Text style={uiStyles.muted}>Video unavailable</Text>
          </View>
        )}
      </View>

      <View style={uiStyles.section}>
        <SectionTitle>Trial Summary</SectionTitle>
        <Panel style={styles.grid}>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Distance</Text>
            <Text style={uiStyles.value}>{trial.distanceM} m</Text>
          </View>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Duration</Text>
            <Text style={uiStyles.value}>{trial.duration}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Surface</Text>
            <Text style={uiStyles.value}>{trial.surface}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={uiStyles.label}>Type</Text>
            <Text style={uiStyles.value}>{trial.type}</Text>
          </View>
          <View style={[styles.cell, { width: "100%" }]}>
            <Text style={uiStyles.label}>Result</Text>
            <Text style={uiStyles.value}>{trial.result}</Text>
          </View>
        </Panel>
      </View>

      {remark && (
        <View style={uiStyles.section}>
          <SectionTitle>Trainer Remark</SectionTitle>
          <Panel>
            <Text style={styles.quote}>"{remark.observation.slice(0, 80)}..."</Text>
            <Link href={`/owner/remark/${remark.id}`} style={styles.link}>
              View full trainer remark →
            </Link>
          </Panel>
        </View>
      )}
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  videoContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: space.lg,
  },
  video: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  noVideo: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
  },
  cell: {
    width: "45%",
    marginBottom: space.sm,
  },
  quote: {
    color: colors.foreground,
    fontSize: 15,
    fontStyle: "italic",
    marginBottom: space.md,
  },
  link: {
    color: colors.primary,
    fontWeight: "700",
  }
});
