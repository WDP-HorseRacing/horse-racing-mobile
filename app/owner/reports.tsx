import { View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { Panel, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/config/theme";

export default function OwnerReports() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  return (
    <Screen role="owner" title="Owner reports" subtitle="Monthly costs for your horses">
      <View style={uiStyles.section}>
        <SectionTitle>Cost report</SectionTitle>
        <Panel style={{ gap: space.md }}>
          <Text style={uiStyles.value}>Per-horse monthly cost reports are not available yet.</Text>
          <Text style={uiStyles.muted}>
            The backend currently has no endpoint that allocates club expenses to an owner’s individual horses. The club-wide finance endpoint also returns 501 in the current backend source.
          </Text>
        </Panel>
      </View>
    </Screen>
  );
}
