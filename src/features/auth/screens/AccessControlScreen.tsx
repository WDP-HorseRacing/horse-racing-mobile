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
          Backend chưa cung cấp API để đọc hoặc cập nhật cấu hình quyền. Màn hình này sẽ hiển thị
          dữ liệu khi backend hỗ trợ.
        </Text>
      </Panel>
    </Screen>
  );
}

export default AccessControlScreen;
