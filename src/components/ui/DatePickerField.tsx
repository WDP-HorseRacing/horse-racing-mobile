import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { radius, space } from "@/config/theme";
import { useI18n } from "@/context/I18nContext";
import { useTheme } from "@/hooks/useTheme";
import { formatToDdMmYyyy, parseToIsoDate } from "@/utils/horse-validation";

export type DatePickerFieldProps = {
  value: string; // DD-MM-YYYY (or YYYY-MM-DD)
  onChangeText: (value: string) => void;
  placeholder?: string;
  title?: string;
  minYear?: number;
  maxYear?: number;
  editable?: boolean;
};

const DAY_NAMES = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

export function DatePickerField({
  value,
  onChangeText,
  placeholder = "DD-MM-YYYY (e.g. 20-05-2021)",
  title,
  minYear = 1985,
  maxYear = new Date().getFullYear(),
  editable = true,
}: DatePickerFieldProps) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const styles = useMemo(() => getStyles(colors), [colors]);

  const [modalVisible, setModalVisible] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  // Parse current value to initialize calendar year and month
  const initialDate = useMemo(() => {
    const iso = parseToIsoDate(value);
    if (iso) {
      const [y, m, d] = iso.split("-").map(Number);
      return { year: y, month: m - 1, day: d };
    }
    const now = new Date();
    // Default to a 3-year-old horse if no date given (common for racehorses)
    return { year: now.getFullYear() - 3, month: now.getMonth(), day: now.getDate() };
  }, [value]);

  const [viewYear, setViewYear] = useState(initialDate.year);
  const [viewMonth, setViewMonth] = useState(initialDate.month);
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDate.day);

  const openModal = () => {
    const iso = parseToIsoDate(value);
    if (iso) {
      const [y, m, d] = iso.split("-").map(Number);
      setViewYear(y);
      setViewMonth(m - 1);
      setSelectedDay(d);
    } else {
      const now = new Date();
      setViewYear(now.getFullYear() - 3);
      setViewMonth(now.getMonth());
      setSelectedDay(null);
    }
    setShowYearPicker(false);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setShowYearPicker(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => Math.max(minYear, y - 1));
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => Math.min(maxYear, y + 1));
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handlePrevYear = () => {
    setViewYear((y) => Math.max(minYear, y - 1));
  };

  const handleNextYear = () => {
    setViewYear((y) => Math.min(maxYear, y + 1));
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    const dd = String(day).padStart(2, "0");
    const mm = String(viewMonth + 1).padStart(2, "0");
    const formatted = `${dd}-${mm}-${viewYear}`;
    onChangeText(formatted);
    closeModal();
  };

  const handleQuickYearSelect = (year: number) => {
    setViewYear(year);
    setShowYearPicker(false);
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    // Day of week for first day (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const firstDayOfWeekRaw = new Date(viewYear, viewMonth, 1).getDay();
    // Convert so Monday = 0, ..., Sunday = 6
    const startOffset = (firstDayOfWeekRaw + 6) % 7;

    const days: ({ day: number; currentMonth: boolean } | null)[] = [];
    // Previous month filler
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }
    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, currentMonth: true });
    }
    return days;
  }, [viewYear, viewMonth]);

  // Year list for quick picker
  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      years.push(y);
    }
    return years;
  }, [minYear, maxYear]);

  // Formatted display value in input
  const displayValue = formatToDdMmYyyy(value);

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInput
          value={displayValue}
          onChangeText={(text) => onChangeText(text)}
          placeholder={t(placeholder)}
          placeholderTextColor={colors.mutedForeground}
          style={styles.textInput}
          editable={editable}
          keyboardType="numbers-and-punctuation"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("Open calendar")}
          onPress={openModal}
          hitSlop={8}
          style={styles.calendarIconBtn}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation?.()}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
                <Text style={styles.modalTitle}>
                  {title ? t(title) : t("Select date of birth")}
                </Text>
              </View>
              <Pressable hitSlop={8} onPress={closeModal}>
                <Ionicons name="close" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Month & Year Navigation Bar */}
            <View style={styles.navBar}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Pressable
                  onPress={handlePrevYear}
                  hitSlop={6}
                  style={styles.navArrowBtn}
                  accessibilityLabel={t("Previous year")}
                >
                  <Ionicons name="play-back" size={14} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={handlePrevMonth}
                  hitSlop={6}
                  style={styles.navArrowBtn}
                  accessibilityLabel={t("Previous month")}
                >
                  <Ionicons name="chevron-back" size={16} color={colors.foreground} />
                </Pressable>
              </View>

              <Pressable
                onPress={() => setShowYearPicker(!showYearPicker)}
                style={[
                  styles.monthYearPill,
                  showYearPicker && { backgroundColor: colors.fitSoft, borderColor: colors.primary },
                ]}
              >
                <Text style={styles.monthYearText}>
                  {t("Month")} {String(viewMonth + 1).padStart(2, "0")} / {viewYear}
                </Text>
                <Ionicons
                  name={showYearPicker ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colors.primary}
                />
              </Pressable>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Pressable
                  onPress={handleNextMonth}
                  hitSlop={6}
                  style={styles.navArrowBtn}
                  accessibilityLabel={t("Next month")}
                >
                  <Ionicons name="chevron-forward" size={16} color={colors.foreground} />
                </Pressable>
                <Pressable
                  onPress={handleNextYear}
                  hitSlop={6}
                  style={styles.navArrowBtn}
                  accessibilityLabel={t("Next year")}
                >
                  <Ionicons name="play-forward" size={14} color={colors.foreground} />
                </Pressable>
              </View>
            </View>

            {/* Quick Year Picker Grid */}
            {showYearPicker ? (
              <View style={styles.yearPickerContainer}>
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>
                  {t("Quick year select:")}
                </Text>
                <ScrollView
                  style={{ maxHeight: 220 }}
                  contentContainerStyle={styles.yearGrid}
                  showsVerticalScrollIndicator
                >
                  {yearOptions.map((year) => {
                    const isSelectedYear = year === viewYear;
                    return (
                      <Pressable
                        key={year}
                        onPress={() => handleQuickYearSelect(year)}
                        style={[
                          styles.yearChip,
                          isSelectedYear && {
                            backgroundColor: colors.primary,
                            borderColor: colors.primary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.yearChipText,
                            isSelectedYear && { color: "#ffffff", fontWeight: "700" },
                          ]}
                        >
                          {year}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <>
                {/* Weekday Labels */}
                <View style={styles.weekdayRow}>
                  {DAY_NAMES.map((name) => (
                    <Text key={name} style={styles.weekdayText}>
                      {name}
                    </Text>
                  ))}
                </View>

                {/* Day Grid */}
                <View style={styles.daysGrid}>
                  {calendarDays.map((item, index) => {
                    if (!item) {
                      return <View key={`empty-${index}`} style={styles.dayCell} />;
                    }
                    const isSelected =
                      selectedDay === item.day &&
                      viewMonth === initialDate.month &&
                      viewYear === initialDate.year;

                    return (
                      <Pressable
                        key={`day-${item.day}`}
                        onPress={() => handleSelectDay(item.day)}
                        style={[
                          styles.dayCell,
                          isSelected && {
                            backgroundColor: colors.primary,
                            borderRadius: radius.pill,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            isSelected && { color: "#ffffff", fontWeight: "700" },
                          ]}
                        >
                          {item.day}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {/* Quick Helper Actions */}
            <View style={styles.footerRow}>
              <Pressable
                onPress={() => {
                  const now = new Date();
                  handleSelectDay(now.getDate());
                }}
                style={styles.quickActionBtn}
              >
                <Text style={{ fontSize: 12, color: colors.primary, fontWeight: "600" }}>
                  {t("Today")}
                </Text>
              </Pressable>

              <Pressable
                onPress={closeModal}
                style={[styles.quickActionBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "600" }}>
                  {t("Close")}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      width: "100%",
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 48,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: space.sm,
    },
    textInput: {
      flex: 1,
      fontSize: 15,
      color: colors.foreground,
      paddingVertical: 10,
    },
    calendarIconBtn: {
      padding: 6,
      marginLeft: 4,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.55)",
      justifyContent: "center",
      alignItems: "center",
      padding: space.md,
    },
    modalCard: {
      width: "100%",
      maxWidth: 360,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
      gap: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 6,
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.foreground,
    },
    navBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 4,
    },
    navArrowBtn: {
      width: 28,
      height: 28,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    monthYearPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: 10,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    monthYearText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.foreground,
    },
    weekdayRow: {
      flexDirection: "row",
      justifyContent: "space-around",
      paddingVertical: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    weekdayText: {
      width: 36,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "600",
      color: colors.mutedForeground,
    },
    daysGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-around",
      gap: 4,
    },
    dayCell: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
    },
    dayText: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.foreground,
    },
    yearPickerContainer: {
      paddingVertical: 6,
      gap: 8,
    },
    sectionSubtitle: {
      fontSize: 12,
      fontWeight: "600",
    },
    yearGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      justifyContent: "center",
      paddingVertical: 4,
    },
    yearChip: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      minWidth: 64,
      alignItems: "center",
    },
    yearChipText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.foreground,
    },
    footerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    quickActionBtn: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: radius.pill,
      backgroundColor: colors.fitSoft,
    },
  });
