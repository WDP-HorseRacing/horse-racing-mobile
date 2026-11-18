import { Text } from "@/components/common/LocalizedText";
import { Screen } from "@/components/common";
import { Panel, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";

export function AccessControlScreen() {
  const uiStyles = getUiStyles(useTheme().colors);

  return (
    <Screen
      role="manager"
      title="Access Control"
      subtitle="Manage roles, access scope, and system permissions"
      back
      fallbackHref="/manager"
    >
      <Panel>
        <Text style={uiStyles.muted}>
          Access is currently determined by the role assigned to each account. Viewing or changing
          individual permissions is not available on this screen yet.
        </Text>
      </Panel>
    </Screen>
  );
}

export default AccessControlScreen;
