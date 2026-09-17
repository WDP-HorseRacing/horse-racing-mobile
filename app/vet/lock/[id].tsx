import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { getHorse, trainingLockReasons } from "@/lib/raceos-data";
import { useRaceOS } from "@/context/RaceOSContext";
import { Chips, TimelineItem } from "@/native/components";
import { Panel, PrimaryButton, Screen, SectionTitle, uiStyles } from "@/native/ui";
import { colors } from "@/native/theme";

export default function LockTraining() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const horse = getHorse(id);
  const { lockHorse, lockedHorseIds } = useRaceOS();
  const [reason, setReason] = useState(trainingLockReasons[0]);
  const [locked, setLocked] = useState(lockedHorseIds.includes(horse.id));
  const confirm = () =>
    Alert.alert(
      "Lock training?",
      "This immediately stops training and notifies the trainer, groom, and owner.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Lock",
          style: "destructive",
          onPress: () => {
            lockHorse(horse.id);
            setLocked(true);
          },
        },
      ],
    );
  if (locked)
    return (
      <Screen role="vet" title="Training locked" subtitle={horse.name} back>
        <View style={uiStyles.alert}>
          <Text style={{ ...uiStyles.value, fontSize: 22 }}>{horse.name} is LOCKED</Text>
          <Text style={uiStyles.muted}>Training stopped · locked by Dr. S. Rao</Text>
        </View>
        <View style={uiStyles.section}>
          <SectionTitle>System events created</SectionTitle>
          <Panel>
            <TimelineItem
              time="Now"
              title="Horse status set to LOCKED"
              detail={`Reason: ${reason}`}
              tone={colors.danger}
            />
            <TimelineItem
              time="Now"
              title="Current session stopped"
              detail="Groom instructed to walk in hand only"
              tone={colors.info}
            />
            <TimelineItem
              time="Now"
              title="Head trainer alerted"
              detail="Training plan adjustment required"
              tone={colors.info}
            />
            <TimelineItem
              time="Now"
              title="Owner notified"
              detail="Health update issued"
              tone={colors.info}
              last
            />
          </Panel>
        </View>
        <PrimaryButton
          label="Open horse profile"
          onPress={() => router.push(`/vet/horse/${horse.id}`)}
        />
        <PrimaryButton label="See what happens next" onPress={() => router.push("/flow")} />
      </Screen>
    );
  return (
    <Screen role="vet" title="Lock training" subtitle="Safety-critical action" back>
      <View style={uiStyles.alert}>
        <Text style={uiStyles.label}>Emergency training lock</Text>
        <Text style={{ ...uiStyles.value, fontSize: 22 }}>{horse.name}</Text>
        <Text style={uiStyles.muted}>
          Stall {horse.stall} · {horse.phase} · fitness {horse.fitness}%
        </Text>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Reason</SectionTitle>
        <Chips options={trainingLockReasons} value={reason} onChange={setReason} />
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Impact</SectionTitle>
        <Panel>
          {[
            "Current training stops immediately",
            "New heavy work cannot be assigned",
            "Head trainer receives a critical alert",
            "Groom receives updated care instructions",
            "Status becomes LOCKED across every role",
          ].map((item) => (
            <Text key={item} style={uiStyles.muted}>
              • {item}
            </Text>
          ))}
        </Panel>
      </View>
      <PrimaryButton label="Lock training" icon="lock-closed" onPress={confirm} />
      <PrimaryButton label="Cancel" icon="close" onPress={() => router.back()} />
    </Screen>
  );
}
