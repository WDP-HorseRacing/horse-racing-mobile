import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { SectionTitle } from "@/components/common";
import { Panel } from "@/components/ui";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import { getUiStyles } from "@/components/ui";
import { space } from "@/config/theme";
import type { GroomWorkloadDto } from "@/services/stable.service";

interface GroomWorkloadSectionProps {
  grooms: GroomWorkloadDto[];
  styles: any;
}

export function GroomWorkloadSection({ grooms, styles }: GroomWorkloadSectionProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const uiStyles = getUiStyles(colors);

  return (
    <View style={[uiStyles.section, { marginTop: space.md }]}>
      <SectionTitle>Groom workload</SectionTitle>
      {grooms.length ? (
        grooms.map((groom) => (
          <Panel key={groom.groomId}>
            <View style={uiStyles.row}>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Text style={[uiStyles.value, { fontSize: 16 }]} numberOfLines={1}>
                  {groom.fullName}
                </Text>
                <Text style={uiStyles.muted} numberOfLines={1}>
                  {t("Groom workload")}
                </Text>
              </View>
              <View style={styles.groomBadge}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.primary} />
                <Text style={styles.groomBadgeText}>
                  {groom.activeHorseCount} {t("active horses")}
                </Text>
              </View>
            </View>
          </Panel>
        ))
      ) : (
        <Text style={uiStyles.muted}>No active Grooms are available for assignment.</Text>
      )}
    </View>
  );
}
