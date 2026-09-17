import { Redirect, router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { Text } from "@/native/LocalizedText";
import { isRole, roles } from "@/native/roles";
import { KeyValue } from "@/native/components";
import { Panel, PrimaryButton, Screen, SectionTitle, uiStyles } from "@/native/ui";

export default function Profile() {
  const { role } = useLocalSearchParams<{ role: string }>();
  if (!isRole(role)) return <Redirect href="/" />;
  const profile = roles[role];
  return (
    <Screen role={role} title="Profile" subtitle={profile.label} back>
      <Panel>
        <Text style={{ ...uiStyles.value, fontSize: 24 }}>{profile.person}</Text>
        <Text style={uiStyles.muted}>{profile.scope}</Text>
      </Panel>
      <View style={uiStyles.section}>
        <SectionTitle>Access</SectionTitle>
        <Panel>
          <KeyValue
            items={[
              ["Role", profile.label],
              ["Workspace", "Meadowline Racing Club"],
              ["Session", "Prototype"],
              ["Audit", "Enabled"],
            ]}
          />
        </Panel>
      </View>
      <View style={uiStyles.section}>
        <SectionTitle>Security</SectionTitle>
        <Panel>
          <Text style={uiStyles.muted}>
            Role-based permissions limit sensitive medical, financial, and operational actions.
            Every material action is recorded.
          </Text>
        </Panel>
      </View>
      <PrimaryButton
        label="Switch workspace"
        icon="swap-horizontal"
        onPress={() => router.replace("/")}
      />
    </Screen>
  );
}
