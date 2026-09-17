import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { Chips, ProgressBar, TimelineItem } from "@/native/components";
import { Panel, PrimaryButton, Screen, SectionTitle, uiStyles } from "@/native/ui";
import { colors } from "@/native/theme";

export default function Medical() {
  const [tab, setTab] = useState("Records");
  return (
    <Screen role="vet" title="Medical">
      <Chips options={["Records", "Treatment", "Vaccination"]} value={tab} onChange={setTab} />
      {tab === "Records" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Recent examinations</SectionTitle>
          <Panel>
            <TimelineItem
              time="Today"
              title="Thunder King · cardiac review"
              detail="Exercise intolerance · ECG follow-up in 72 h"
              tone={colors.danger}
            />
            <TimelineItem
              time="Yesterday"
              title="Silver Arrow · appetite"
              detail="Under observation · bloodwork clear"
              tone={colors.warning}
            />
            <TimelineItem
              time="Sep 10"
              title="Iron Verdict · routine exam"
              detail="No findings"
              tone={colors.primary}
              last
            />
          </Panel>
          <PrimaryButton
            label="Record examination"
            onPress={() => router.push("/vet/exam/thunder-king")}
          />
        </View>
      ) : null}
      {tab === "Treatment" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Active treatment plans</SectionTitle>
          {[
            ["Thunder King", "Cardiac monitoring · rest 10 days", 65],
            ["Red Storm", "Left fore rehabilitation · ice bath", 38],
          ].map(([horse, plan, progress]) => (
            <Panel key={String(horse)}>
              <View style={uiStyles.row}>
                <Text style={uiStyles.value}>{horse}</Text>
                <Text style={uiStyles.value}>{progress}%</Text>
              </View>
              <Text style={uiStyles.muted}>{plan}</Text>
              <View style={{ height: 10 }} />
              <ProgressBar value={Number(progress)} tone={colors.warning} />
            </Panel>
          ))}
        </View>
      ) : null}
      {tab === "Vaccination" ? (
        <View style={uiStyles.section}>
          <SectionTitle>Vaccination & farrier history</SectionTitle>
          <Panel>
            <TimelineItem
              time="Sep 10"
              title="Tetanus booster · Iron Verdict"
              detail="Batch TT-2291"
              tone={colors.primary}
            />
            <TimelineItem time="Aug 28" title="Farrier · Golden Hour" detail="No hoof findings" />
            <TimelineItem
              time="Aug 14"
              title="Influenza booster · Night Quartz"
              detail="Batch EI-8842"
              tone={colors.primary}
              last
            />
          </Panel>
        </View>
      ) : null}
    </Screen>
  );
}
