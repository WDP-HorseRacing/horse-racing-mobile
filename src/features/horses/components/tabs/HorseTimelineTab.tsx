import { View } from "react-native";
import { AsyncStateView, SectionTitle, TimelineItem } from "@/components/common";
import { Panel, getUiStyles } from "@/components/ui";
import { useTheme } from "@/hooks/useTheme";
import { formatDateTime, formatEnum } from "@/utils/formatters";
import type { AuditLogDto } from "@/adapters/audit.adapter";

export type HorseTimelineTabProps = {
  auditResource: {
    isLoading: boolean;
    error: unknown;
    data: AuditLogDto[] | null;
    retry: () => void | Promise<unknown>;
  };
};

export function HorseTimelineTab({ auditResource }: HorseTimelineTabProps) {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);

  return (
    <View style={uiStyles.section}>
      <SectionTitle>Horse activity</SectionTitle>
      <AsyncStateView
        isLoading={auditResource.isLoading}
        error={auditResource.error}
        onRetry={() => void auditResource.retry()}
        empty={Boolean(auditResource.data && auditResource.data.length === 0)}
        emptyLabel="No audit activity is recorded for this horse."
      />
      {auditResource.data?.length ? (
        <Panel>
          {auditResource.data.map((entry, index) => (
            <TimelineItem
              key={entry.id}
              time={formatDateTime(entry.createdAt)}
              title={`${entry.action} · ${formatEnum(entry.entityType)}`}
              detail={[
                entry.actor?.fullName ?? "System",
                entry.feature ? formatEnum(entry.feature) : null,
                entry.reason,
              ]
                .filter(Boolean)
                .join(" · ")}
              tone={index === 0 ? colors.primary : colors.training}
              last={index === (auditResource.data?.length ?? 0) - 1}
            />
          ))}
        </Panel>
      ) : null}
    </View>
  );
}

export default HorseTimelineTab;
