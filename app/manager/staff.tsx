import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { AsyncStateView } from "@/components/common/AsyncStateView";
import {
  Chips,
  Field,
  NativeInput,
  Panel,
  PrimaryButton,
  SecondaryButton,
  getUiStyles,
} from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { useApiResource } from "@/hooks/useApiResource";
import { useTheme } from "@/hooks/useTheme";
import { usersService } from "@/services/users.service";
import {
  mapStaffMember,
  STAFF_ROLE_OPTIONS,
  staffRoleFromLabel,
  type StaffDto,
  type StaffStatus,
} from "@/adapters/staff.adapter";
import { showApiError } from "@/utils/errorHandler";
import { radius, space } from "@/config/theme";

export default function StaffManagement() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const { token, user } = useAuth();
  const [editingPerson, setEditingPerson] = useState<StaffDto | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [confirmStaffPassword, setConfirmStaffPassword] = useState("");
  const [role, setRole] = useState("Groom");

  const loadStaff = useCallback(() => usersService.list(token!), [token]);
  const resource = useApiResource(loadStaff, Boolean(token));
  const staffList = resource.data ?? [];

  const openAdd = () => {
    setName("");
    setEmail("");
    setPassword("");
    setNewStaffPassword("");
    setConfirmStaffPassword("");
    setRole("Groom");
    setEditingPerson(null);
    setIsAdding(true);
  };

  const openEdit = (person: StaffDto) => {
    setName(person.fullName);
    setEmail(person.email);
    setPassword("");
    setNewStaffPassword("");
    setConfirmStaffPassword("");
    setRole(person.role ? mapStaffMember(person).roleLabel : "Groom");
    setEditingPerson(person);
    setIsAdding(true);
  };

  const savePerson = async () => {
    if (!token || !name.trim() || (!editingPerson && (!email.trim() || password.length < 8))) {
      Alert.alert(
        "Missing information",
        editingPerson
          ? "Enter the staff member’s name."
          : "Enter a name, email, and password of at least 8 characters.",
      );
      return;
    }
    setIsSaving(true);
    try {
      if (editingPerson) {
        await usersService.update(token, editingPerson.id, {
          fullName: name.trim(),
          role: staffRoleFromLabel(role),
        });
      } else {
        await usersService.create(token, {
          fullName: name.trim(),
          email: email.trim(),
          role: staffRoleFromLabel(role),
          password,
        });
      }
      setIsAdding(false);
      await resource.refresh();
    } catch (error) {
      showApiError(error, "Could not save staff account");
    } finally {
      setIsSaving(false);
    }
  };

  const canResetPassword = Boolean(
    editingPerson &&
      editingPerson.id !== user?.userId &&
      editingPerson.role !== "CLUB_MANAGER" &&
      staffRoleFromLabel(role) !== "CLUB_MANAGER",
  );

  const resetStaffPassword = () => {
    const target = editingPerson;
    if (!token || !target || !canResetPassword) return;
    if (newStaffPassword.length < 8 || newStaffPassword !== confirmStaffPassword) {
      Alert.alert(
        "Check the new password",
        "Enter a password of at least 8 characters and confirm it exactly.",
      );
      return;
    }
    Alert.alert(
      "Reset staff password?",
      `All current sessions for ${target.fullName} will be signed out. The account status will stay ${target.status.toLowerCase()}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset password",
          onPress: () => {
            setIsSaving(true);
            void usersService
              .resetPassword(token, target.id, newStaffPassword)
              .then(() => {
                setNewStaffPassword("");
                setConfirmStaffPassword("");
                Alert.alert("Password reset", "The new password is ready for the staff member.");
              })
              .catch((error) => showApiError(error, "Could not reset staff password"))
              .finally(() => setIsSaving(false));
          },
        },
      ],
    );
  };

  const toggleStatus = (person: StaffDto) => {
    const nextStatus: StaffStatus = person.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const action = nextStatus === "ACTIVE" ? "activate" : "deactivate";
    Alert.alert(
      `${action[0].toUpperCase()}${action.slice(1)} staff`,
      `Change ${person.fullName} to ${nextStatus.toLowerCase()}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action,
          onPress: () => {
            void usersService
              .setStatus(token!, person.id, nextStatus)
              .then(() => resource.refresh())
              .catch((error) => showApiError(error, "Could not update staff status"));
          },
        },
      ],
    );
  };

  if (isAdding) {
    return (
      <Screen
        role="manager"
        title={editingPerson ? "Edit staff" : "Add staff"}
        subtitle={editingPerson?.fullName ?? "New club account"}
        back
        onBack={() => setIsAdding(false)}
        fallbackHref="/manager/operations"
      >
        <Field label="Full name">
          <NativeInput value={name} onChangeText={setName} placeholder="e.g. Nguyen Van A" />
        </Field>
        {!editingPerson ? (
          <>
            <Field label="Email">
              <NativeInput
                value={email}
                onChangeText={setEmail}
                placeholder="staff@racehorse.com"
                keyboardType="email-address"
              />
            </Field>
            <Field label="Initial password (8+ characters)">
              <NativeInput
                value={password}
                onChangeText={setPassword}
                placeholder="Enter initial password"
                secureTextEntry
              />
            </Field>
          </>
        ) : (
          <Panel>
            <Text style={uiStyles.label}>Email</Text>
            <Text style={uiStyles.value}>{editingPerson.email}</Text>
          </Panel>
        )}
        <View style={uiStyles.section}>
          <SectionTitle>Role</SectionTitle>
          <Chips options={[...STAFF_ROLE_OPTIONS]} value={role} onChange={setRole} />
        </View>
        <PrimaryButton
          label={isSaving ? "Saving…" : "Save changes"}
          icon="checkmark"
          onPress={() => void savePerson()}
          disabled={isSaving}
        />
        {canResetPassword ? (
          <View style={uiStyles.section}>
            <SectionTitle>Reset staff password</SectionTitle>
            <Field label="New password (8+ characters)">
              <NativeInput
                value={newStaffPassword}
                onChangeText={setNewStaffPassword}
                placeholder="Enter new password"
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>
            <Field label="Confirm new password">
              <NativeInput
                value={confirmStaffPassword}
                onChangeText={setConfirmStaffPassword}
                placeholder="Re-enter new password"
                secureTextEntry
                autoCapitalize="none"
              />
            </Field>
            <SecondaryButton
              label="Reset password and sign out sessions"
              icon="key-outline"
              disabled={
                isSaving ||
                newStaffPassword.length < 8 ||
                newStaffPassword !== confirmStaffPassword
              }
              onPress={resetStaffPassword}
            />
          </View>
        ) : null}
        {editingPerson ? (
          <SecondaryButton
            label={editingPerson.status === "ACTIVE" ? "Deactivate account" : "Activate account"}
            icon={
              editingPerson.status === "ACTIVE" ? "person-remove-outline" : "person-add-outline"
            }
            onPress={() => toggleStatus(editingPerson)}
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen
      role="manager"
      title="Staff"
      subtitle="Manage club accounts and roles"
      back
      fallbackHref="/manager/operations"
      refreshing={resource.isRefreshing}
      onRefresh={() => void resource.refresh()}
    >
      <AsyncStateView
        isLoading={resource.isLoading}
        error={resource.error}
        onRetry={() => void resource.retry()}
      />
      <PrimaryButton label="Add staff" icon="add" onPress={openAdd} />
      <View style={uiStyles.section}>
        <SectionTitle>Personnel list</SectionTitle>
        {resource.data && staffList.length === 0 ? (
          <AsyncStateView
            isLoading={false}
            error={null}
            onRetry={() => undefined}
            empty
            emptyLabel="There are no staff accounts."
          />
        ) : null}
        {staffList.map((person) => {
          const member = mapStaffMember(person);
          return (
            <Pressable key={person.id} onPress={() => openEdit(person)}>
              <Panel>
                <View style={uiStyles.row}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radius.pill,
                      backgroundColor: colors.fitSoft,
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: space.sm,
                      flexShrink: 0,
                    }}
                  >
                    <Text style={{ color: colors.primary, fontSize: 14, fontWeight: "800" }}>
                      {person.fullName
                        .split(" ")
                        .map((part) => part[0])
                        .slice(-2)
                        .join("")}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={uiStyles.value} numberOfLines={1}>
                      {person.fullName}
                    </Text>
                    <Text style={uiStyles.muted} numberOfLines={1}>
                      {person.email}
                    </Text>
                    <Text style={uiStyles.label} numberOfLines={1}>
                      {member.roleLabel}
                    </Text>
                  </View>
                  <Text
                    style={{
                      ...uiStyles.muted,
                      flexShrink: 0,
                      color:
                        person.status === "ACTIVE"
                          ? colors.primary
                          : person.status === "INACTIVE"
                            ? colors.destructive
                            : colors.monitor,
                    }}
                  >
                    {member.statusLabel}
                  </Text>
                </View>
              </Panel>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
