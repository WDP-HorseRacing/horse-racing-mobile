import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "@/components/common/LocalizedText";
import { Screen } from "@/components/common";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import {
  BottomSheetModal,
  Chips,
  Field,
  NativeInput,
  getUiStyles,
} from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/context/I18nContext";
import { useApiResource } from "@/hooks/useApiResource";
import { radius, space, type ThemeColors } from "@/config/theme";
import {
  stableCareService,
  type CareTaskTypeDto,
} from "@/services/stable-care.service";
import { extractErrorMessage } from "@/utils/errorHandler";
import { normalizeVietnamese } from "@/utils/horse-validation";

export function CareTaskTypesScreen() {
  const { token } = useAuth();
  const { colors } = useTheme();
  const { t } = useI18n();
  const ui = getUiStyles(colors);
  const careStyles = useMemo(() => getCareStyles(colors), [colors]);
  const load = useCallback(() => stableCareService.listTaskTypes(token!), [token]);
  const resource = useApiResource(load, Boolean(token));
  const [name, setName] = useState("");
  const [appliesToAll, setAppliesToAll] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<
    "ALL" | "APPLIES_ALL" | "INDIVIDUAL" | "ACTIVE" | "INACTIVE"
  >("ALL");

  const rawItems = resource.data ?? [];
  const filteredItems = useMemo(() => {
    let list = rawItems;
    if (search.trim()) {
      const q = normalizeVietnamese(search.trim().toLowerCase());
      list = list.filter((item) => normalizeVietnamese(item.name.toLowerCase()).includes(q));
    }
    if (filter === "APPLIES_ALL") {
      list = list.filter((item) => item.appliesToAll);
    } else if (filter === "INDIVIDUAL") {
      list = list.filter((item) => !item.appliesToAll);
    } else if (filter === "ACTIVE") {
      list = list.filter((item) => item.active);
    } else if (filter === "INACTIVE") {
      list = list.filter((item) => !item.active);
    }
    return list;
  }, [rawItems, search, filter]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await stableCareService.createTaskType(token!, { name: name.trim(), appliesToAll });
      setName("");
      setShowAddModal(false);
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not create task type"), extractErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const patch = async (
    item: CareTaskTypeDto,
    input: { name?: string; active?: boolean; appliesToAll?: boolean },
  ) => {
    try {
      await stableCareService.updateTaskType(token!, item.id, input);
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not update task type"), extractErrorMessage(error));
    }
  };

  const rename = async (item: CareTaskTypeDto) => {
    if (!editingName.trim()) {
      Alert.alert(t("Enter a task name"), t("Task type name cannot be blank."));
      return;
    }
    try {
      await stableCareService.updateTaskType(token!, item.id, { name: editingName.trim() });
      setEditingTypeId(null);
      setEditingName("");
      await resource.refresh();
    } catch (error) {
      Alert.alert(t("Could not rename task type"), extractErrorMessage(error));
    }
  };

  return (
    <Screen
      role="manager"
      title="Care task types"
      subtitle="Manage reusable stable care tasks"
      back
      fallbackHref="/manager"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />

      {/* Search & Actions Header */}
      <View style={{ gap: space.sm, marginBottom: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: space.sm,
              height: 42,
            }}
          >
            <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("Tìm loại việc chăm sóc...")}
              placeholderTextColor={colors.mutedForeground}
              style={{
                flex: 1,
                color: colors.foreground,
                fontSize: 14,
                padding: 0,
              }}
              autoCapitalize="none"
            />
            {search.length > 0 ? (
              <Pressable onPress={() => setSearch("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Thêm loại việc")}
            onPress={() => {
              setName("");
              setAppliesToAll(false);
              setShowAddModal(true);
            }}
            style={careStyles.createPlanBtn}
          >
            <Ionicons name="add" size={16} color="#FFFFFF" />
            <Text style={careStyles.createPlanBtnText}>{t("Thêm")}</Text>
          </Pressable>
        </View>

        <Chips
          options={[t("Tất cả"), t("Việc chung"), t("Việc riêng"), t("Đang dùng"), t("Tạm dừng")]}
          value={
            filter === "APPLIES_ALL"
              ? t("Việc chung")
              : filter === "INDIVIDUAL"
                ? t("Việc riêng")
                : filter === "ACTIVE"
                  ? t("Đang dùng")
                  : filter === "INACTIVE"
                    ? t("Tạm dừng")
                    : t("Tất cả")
          }
          onChange={(val) => {
            if (val === t("Việc chung")) setFilter("APPLIES_ALL");
            else if (val === t("Việc riêng")) setFilter("INDIVIDUAL");
            else if (val === t("Đang dùng")) setFilter("ACTIVE");
            else if (val === t("Tạm dừng")) setFilter("INACTIVE");
            else setFilter("ALL");
          }}
        />
      </View>

      {/* Cards List matching horse list aesthetic */}
      <View style={{ gap: space.sm }}>
        {filteredItems.map((item) => {
          const isActive = item.active;
          const appliesAll = item.appliesToAll;

          return (
            <View key={item.id} style={careStyles.taskTypeCard}>
              {/* Left Icon mark */}
              <View
                style={[
                  careStyles.taskTypeIconBox,
                  { backgroundColor: isActive ? colors.fitSoft : colors.elevated },
                ]}
              >
                <Ionicons
                  name={appliesAll ? "globe-outline" : "hand-left-outline"}
                  size={22}
                  color={isActive ? colors.primary : colors.mutedForeground}
                />
              </View>

              {/* Middle copy */}
              <View style={careStyles.taskTypeContent}>
                <View style={careStyles.taskTypeHeader}>
                  <Text
                    style={[
                      careStyles.taskTypeName,
                      !isActive && { color: colors.mutedForeground },
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <View
                    style={[
                      careStyles.taskTypeStatusBadge,
                      { backgroundColor: isActive ? colors.fitSoft : colors.elevated },
                    ]}
                  >
                    <Text
                      style={[
                        careStyles.taskTypeStatusText,
                        { color: isActive ? colors.primary : colors.mutedForeground },
                      ]}
                    >
                      {isActive ? t("Đang dùng") : t("Tạm dừng")}
                    </Text>
                  </View>
                </View>

                {/* Scope pill */}
                <View style={careStyles.taskTypeMetaRow}>
                  <View
                    style={[
                      careStyles.taskTypeScopePill,
                      { backgroundColor: appliesAll ? colors.fitSoft : colors.monitorSoft },
                    ]}
                  >
                    <Ionicons
                      name={appliesAll ? "globe-outline" : "person-outline"}
                      size={12}
                      color={appliesAll ? colors.primary : colors.monitor}
                    />
                    <Text
                      style={[
                        careStyles.taskTypeScopeText,
                        { color: appliesAll ? colors.primary : colors.monitor },
                      ]}
                    >
                      {appliesAll ? t("Áp dụng tất cả ngựa") : t("Việc riêng từng con")}
                    </Text>
                  </View>
                </View>

                {/* Actions row */}
                <View style={careStyles.taskTypeActionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Đổi tên")}
                    style={careStyles.taskTypeActionBtn}
                    onPress={() => {
                      setEditingTypeId(item.id);
                      setEditingName(item.name);
                    }}
                  >
                    <Ionicons name="pencil-outline" size={13} color={colors.foreground} />
                    <Text style={careStyles.taskTypeActionBtnText}>{t("Đổi tên")}</Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={appliesAll ? t("Thành việc riêng") : t("Áp dụng tất cả")}
                    style={careStyles.taskTypeActionBtn}
                    onPress={() => void patch(item, { appliesToAll: !item.appliesToAll })}
                  >
                    <Ionicons name="swap-horizontal" size={13} color={colors.foreground} />
                    <Text style={careStyles.taskTypeActionBtnText}>
                      {appliesAll ? t("Thành việc riêng") : t("Áp dụng tất cả")}
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={isActive ? t("Tạm dừng") : t("Kích hoạt")}
                    style={[
                      careStyles.taskTypeActionBtn,
                      isActive
                        ? careStyles.taskTypeActionBtnDanger
                        : careStyles.taskTypeActionBtnSuccess,
                    ]}
                    onPress={() => void patch(item, { active: !item.active })}
                  >
                    <Ionicons
                      name={isActive ? "pause-outline" : "play-outline"}
                      size={13}
                      color={isActive ? colors.destructive : colors.primary}
                    />
                    <Text
                      style={[
                        careStyles.taskTypeActionBtnText,
                        { color: isActive ? colors.destructive : colors.primary },
                      ]}
                    >
                      {isActive ? t("Tạm dừng") : t("Kích hoạt")}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}

        {!filteredItems.length && !resource.isLoading ? (
          <Text style={[ui.muted, { textAlign: "center", paddingVertical: space.xl }]}>
            {search.trim() || filter !== "ALL"
              ? t("Không tìm thấy loại việc phù hợp.")
              : t("Chưa có loại việc chăm sóc nào.")}
          </Text>
        ) : null}
      </View>

      <BottomSheetModal
        visible={Boolean(editingTypeId)}
        title={t("Đổi tên loại việc")}
        saveLabel={t("Lưu")}
        cancelLabel={t("Cancel")}
        saveDisabled={!editingName.trim()}
        onSave={() => {
          const item = rawItems.find((t) => t.id === editingTypeId);
          if (item) void rename(item);
        }}
        onClose={() => {
          setEditingTypeId(null);
          setEditingName("");
        }}
      >
        <Field label={t("Tên loại việc")}>
          <NativeInput
            value={editingName}
            onChangeText={setEditingName}
            placeholder={t("Nhập tên mới")}
          />
        </Field>
      </BottomSheetModal>

      <BottomSheetModal
        visible={showAddModal}
        title={t("Thêm loại việc chăm sóc")}
        saveLabel={saving ? t("Saving…") : t("Lưu")}
        cancelLabel={t("Cancel")}
        saveDisabled={!name.trim() || saving}
        saveLoading={saving}
        onSave={() => void create()}
        onClose={() => setShowAddModal(false)}
      >
        <Field label={t("Tên loại việc chăm sóc")}>
          <NativeInput
            value={name}
            onChangeText={setName}
            placeholder={t("VD: Chăm sóc đặc biệt, Băng bó...")}
          />
        </Field>
        <Field label={t("Phạm vi áp dụng")}>
          <Chips
            options={[t("Việc riêng từng con"), t("Áp dụng tất cả ngựa")]}
            value={appliesToAll ? t("Áp dụng tất cả ngựa") : t("Việc riêng từng con")}
            onChange={(value) => setAppliesToAll(value === t("Áp dụng tất cả ngựa"))}
          />
        </Field>
      </BottomSheetModal>
    </Screen>
  );
}

const getCareStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    createPlanBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radius.pill,
    },
    createPlanBtnText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    taskTypeCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: space.md,
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: space.md,
    },
    taskTypeIconBox: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    taskTypeContent: {
      flex: 1,
      minWidth: 0,
      gap: 6,
    },
    taskTypeHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: space.sm,
    },
    taskTypeName: {
      flex: 1,
      minWidth: 0,
      fontSize: 16,
      fontWeight: "700",
      color: colors.foreground,
    },
    taskTypeStatusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radius.pill,
    },
    taskTypeStatusText: {
      fontSize: 11,
      fontWeight: "700",
    },
    taskTypeMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    taskTypeScopePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    taskTypeScopeText: {
      fontSize: 11,
      fontWeight: "600",
    },
    taskTypeActionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
      flexWrap: "wrap",
    },
    taskTypeActionBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 5,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.elevated,
    },
    taskTypeActionBtnText: {
      fontSize: 12,
      fontWeight: "600",
      color: colors.foreground,
    },
    taskTypeActionBtnDanger: {
      borderColor: colors.injuredSoft,
      backgroundColor: colors.injuredSoft,
    },
    taskTypeActionBtnSuccess: {
      borderColor: colors.fitSoft,
      backgroundColor: colors.fitSoft,
    },
  });

export default CareTaskTypesScreen;
