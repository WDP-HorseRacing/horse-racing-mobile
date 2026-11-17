import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Pressable, ScrollView, View } from "react-native";
import { SectionTitle } from "@/components/common";
import { Text } from "@/components/common/LocalizedText";
import { Field, NativeInput, getUiStyles, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { GroomTodayDto } from "@/adapters/groom.adapter";
import type { LocalMediaAsset } from "@/services/media.service";
import { useTheme } from "@/hooks/useTheme";
import { space } from "@/config/theme";

type IncidentHorse = GroomTodayDto["horses"][number];
type IncidentReportStyles = Record<string, any>;
type IncidentUiStyles = ReturnType<typeof getUiStyles>;
type IncidentColors = ReturnType<typeof useTheme>["colors"];

type IncidentReportFormProps = {
  horses: GroomTodayDto["horses"];
  selectedHorse?: IncidentHorse;
  horseId: string;
  horsePickerOpen: boolean;
  setHorsePickerOpen: (open: boolean) => void;
  horseSearch: string;
  setHorseSearch: (search: string) => void;
  filteredHorses: GroomTodayDto["horses"];
  setHorseId: (horseId: string) => void;
  description: string;
  setDescription: (description: string) => void;
  quickIncidentOptions: string[];
  selectedQuickOptions: string[];
  toggleQuickOption: (option: string) => void;
  urgent: boolean;
  setUrgent: (urgent: boolean) => void;
  photo: LocalMediaAsset | null;
  setPhoto: (photo: LocalMediaAsset | null) => void;
  promptPhotoOptions: () => void;
  uploading: boolean;
  saving: boolean;
  submit: () => void;
  t: (value: string) => string;
  colors: IncidentColors;
  ui: IncidentUiStyles;
  styles: IncidentReportStyles;
};

export function IncidentReportForm({
  horses,
  selectedHorse,
  horseId,
  horsePickerOpen,
  setHorsePickerOpen,
  horseSearch,
  setHorseSearch,
  filteredHorses,
  setHorseId,
  description,
  setDescription,
  quickIncidentOptions: QUICK_INCIDENT_OPTIONS,
  selectedQuickOptions,
  toggleQuickOption,
  urgent,
  setUrgent,
  photo,
  setPhoto,
  promptPhotoOptions,
  uploading,
  saving,
  submit,
  t,
  colors,
  ui,
  styles,
}: IncidentReportFormProps) {
  return (
    <View style={ui.section}>
      <SectionTitle>Report an incident</SectionTitle>

      {/* Horse Selector Trigger */}
      {horses.length ? (
        <>
          {selectedHorse ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setHorsePickerOpen(true)}
              style={styles.selectedHorseCard}
            >
              <View style={styles.horseCardAvatar}>
                <Ionicons name="paw" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[ui.value, { fontWeight: "700" }]} numberOfLines={1}>
                  {selectedHorse.horseName}
                </Text>
                <Text style={ui.muted} numberOfLines={1}>
                  {selectedHorse.stallCode
                    ? `Stall ${selectedHorse.stallCode}`
                    : (selectedHorse.barnName ?? "No stall assigned")}
                </Text>
              </View>
              <View style={styles.changeBadge}>
                <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>
                  Change
                </Text>
                <Ionicons name="swap-horizontal" size={15} color={colors.primary} />
              </View>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setHorsePickerOpen(true)}
              style={styles.selectHorseTrigger}
            >
              <Ionicons name="paw-outline" size={20} color={colors.mutedForeground} />
              <Text style={[ui.muted, { flex: 1, fontSize: 15 }]}>
                Select horse to report incident
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
        </>
      ) : (
        <Text style={ui.muted}>
          Only horses assigned to you in Groom Today can be reported.
        </Text>
      )}

      {/* Horse Picker Modal */}
      <Modal
        visible={horsePickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setHorsePickerOpen(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select horse</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setHorsePickerOpen(false)}
              style={styles.modalCloseBtn}
            >
              <Ionicons name="close" size={22} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.modalSearchBox}>
            <NativeInput
              value={horseSearch}
              onChangeText={setHorseSearch}
              placeholder="Search horse by name or stall"
            />
          </View>

          <ScrollView contentContainerStyle={styles.horseListContent}>
            {filteredHorses.map((horse) => {
              const isCurrent = horse.horseId === horseId;
              return (
                <Pressable
                  key={horse.horseId}
                  accessibilityRole="button"
                  onPress={() => {
                    setHorseId(horse.horseId);
                    setHorsePickerOpen(false);
                    setHorseSearch("");
                  }}
                  style={[
                    styles.horsePickerItem,
                    isCurrent && {
                      borderColor: colors.primary,
                      backgroundColor: colors.fitSoft,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <View style={styles.horseCardAvatar}>
                    <Ionicons
                      name="paw"
                      size={18}
                      color={isCurrent ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[ui.value, { fontWeight: "700" }]} numberOfLines={1}>
                      {horse.horseName}
                    </Text>
                    <Text style={ui.muted} numberOfLines={1}>
                      {horse.stallCode
                        ? `Stall ${horse.stallCode}`
                        : (horse.barnName ?? "No stall assigned")}
                    </Text>
                  </View>
                  {isCurrent ? (
                    <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                  ) : (
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                  )}
                </Pressable>
              );
            })}
            {!filteredHorses.length ? (
              <Text style={[ui.muted, { textAlign: "center", marginTop: 24 }]}>
                No horses found matching this search.
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>

      {/* Quick Incident Options */}
      <View style={{ gap: space.xs }}>
        <Text style={[ui.label, { fontSize: 13 }]}>{t("Quick incident options")}</Text>
        <Text style={[ui.muted, { fontSize: 12, marginTop: -2 }]}>
          {t("Select common issues or type below")}
        </Text>
        <View style={styles.quickOptionsWrap}>
          {QUICK_INCIDENT_OPTIONS.map((opt) => {
            const active = selectedQuickOptions.includes(opt);
            return (
              <Pressable
                key={opt}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => toggleQuickOption(opt)}
                style={[styles.quickOptionChip, active && styles.quickOptionChipActive]}
              >
                <Ionicons
                  name={active ? "checkmark-circle" : "add-circle-outline"}
                  size={15}
                  color={active ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.quickOptionChipText,
                    active && styles.quickOptionChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {t(opt)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Field label="What happened?">
        <NativeInput
          value={description}
          onChangeText={setDescription}
          multiline
          placeholder="Describe what you observed"
        />
      </Field>

      {/* Normal vs Urgent 2-card selector */}
      <View style={styles.urgencyContainer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setUrgent(false)}
          style={[styles.urgencyCard, !urgent && styles.urgencyCardActiveNormal]}
        >
          <View style={styles.urgencyHeaderRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={22}
              color={!urgent ? colors.primary : colors.mutedForeground}
            />
            {!urgent ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
            ) : null}
          </View>
          <Text
            style={[
              styles.urgencyCardTitle,
              !urgent && { color: colors.primary, fontWeight: "700" },
            ]}
          >
            Normal
          </Text>
          <Text style={styles.urgencyCardHint} numberOfLines={2}>
            Routine stable care observation
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setUrgent(true)}
          style={[styles.urgencyCard, urgent && styles.urgencyCardActiveUrgent]}
        >
          <View style={styles.urgencyHeaderRow}>
            <Ionicons
              name="alert-circle"
              size={22}
              color={urgent ? colors.destructive : colors.destructive}
            />
            {urgent ? (
              <Ionicons name="checkmark-circle" size={18} color={colors.destructive} />
            ) : null}
          </View>
          <Text
            style={[
              styles.urgencyCardTitle,
              urgent && { color: colors.destructive, fontWeight: "800" },
            ]}
          >
            Urgent
          </Text>
          <Text
            style={[styles.urgencyCardHint, urgent && { color: colors.destructive }]}
            numberOfLines={2}
          >
            Requires immediate vet attention
          </Text>
        </Pressable>
      </View>

      {urgent ? (
        <View style={styles.urgentAlertBox}>
          <Ionicons name="warning" size={18} color={colors.destructive} />
          <Text
            style={[
              ui.muted,
              { color: colors.destructive, flex: 1, fontWeight: "600", fontSize: 13 },
            ]}
          >
            Urgent reports automatically create an urgent medical exam request.
          </Text>
        </View>
      ) : null}

      {/* Photo attachment with camera / photo library */}
      {photo ? (
        <View style={styles.photoPreviewCard}>
          <Image source={{ uri: photo.uri }} style={styles.photoThumbnail} resizeMode="cover" />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={[ui.value, { fontSize: 14 }]} numberOfLines={1} ellipsizeMode="middle">
              {photo.name}
            </Text>
            <Text style={ui.muted}>
              {photo.size ? `${(photo.size / (1024 * 1024)).toFixed(1)} MB` : "Attached photo"}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPhoto(null)}
              style={styles.removePhotoBtn}
            >
              <Ionicons name="trash-outline" size={15} color={colors.destructive} />
              <Text style={{ color: colors.destructive, fontSize: 13, fontWeight: "600" }}>
                Remove photo
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <SecondaryButton
          label="Attach photo"
          icon="camera-outline"
          onPress={promptPhotoOptions}
        />
      )}

      <PrimaryButton
        label={uploading ? "Uploading photo…" : saving ? "Sending…" : "Send incident report"}
        icon="paper-plane-outline"
        onPress={() => void submit()}
        disabled={saving || !selectedHorse || !description.trim()}
      />
    </View>
  );
}
