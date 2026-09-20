import { useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { staff as initialStaff } from "@/lib/raceos-data";
import { Panel, PrimaryButton, Field, NativeInput, Chips, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { space, radius } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export default function StaffManagement() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  const [staffList, setStaffList] = useState(initialStaff);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [role, setRole] = useState("Groom");
  const [scope, setScope] = useState("");
  const [status, setStatus] = useState("Active");

  const openAdd = () => {
    setName("");
    setRole("Groom");
    setScope("");
    setStatus("Active");
    setEditingPerson(null);
    setIsAdding(true);
  };

  const openEdit = (person: any) => {
    setName(person.name);
    setRole(person.role);
    setScope(person.scope);
    setStatus(person.status);
    setEditingPerson(person);
    setIsAdding(true);
  };

  const savePerson = () => {
    if (!name || !scope) {
      Alert.alert("Missing information", "Please fill in all fields.");
      return;
    }

    if (editingPerson) {
      setStaffList(
        staffList.map((p) =>
          p.name === editingPerson.name
            ? { ...p, name, role, scope, status }
            : p
        )
      );
    } else {
      setStaffList([...staffList, { name, role, scope, status }]);
    }
    setIsAdding(false);
  };

  const deactivatePerson = () => {
    Alert.alert(
      "Deactivate Staff",
      `Are you sure you want to deactivate ${editingPerson?.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Deactivate",
          style: "destructive",
          onPress: () => {
            setStaffList(
              staffList.map((p) =>
                p.name === editingPerson.name ? { ...p, status: "Deactivated" } : p
              )
            );
            setIsAdding(false);
          },
        },
      ]
    );
  };

  if (isAdding) {
    return (
      <Screen
        role="manager"
        title={editingPerson ? "Edit Staff" : "Add Staff"}
        subtitle={editingPerson ? editingPerson.name : "New club personnel"}
        back
      >
        <Field label="Full Name">
          <NativeInput value={name} onChangeText={setName} placeholder="e.g. John Doe" />
        </Field>

        <View style={uiStyles.section}>
          <SectionTitle>Role</SectionTitle>
          <Chips
            options={["Head Trainer", "Veterinarian", "Groom", "Horse Owner", "Manager"]}
            value={role}
            onChange={setRole}
          />
        </View>

        <Field label="Assigned Scope">
          <NativeInput
            value={scope}
            onChangeText={setScope}
            placeholder="e.g. A wing · 8 horses"
          />
        </Field>

        <View style={uiStyles.section}>
          <SectionTitle>Account Status</SectionTitle>
          <Chips
            options={["Active", "Off shift", "Deactivated"]}
            value={status}
            onChange={setStatus}
          />
        </View>

        <View style={{ height: space.md }} />
        <PrimaryButton label="Save Changes" icon="checkmark" onPress={savePerson} />
        {editingPerson && (
          <View style={{ marginTop: space.sm }}>
            <PrimaryButton
              label="Deactivate Staff"
              icon="trash-outline"
              onPress={deactivatePerson}
            />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen role="manager" title="Staff" subtitle="Manage club personnel and their assignments" back>
      <PrimaryButton label="Add Staff" icon="add" onPress={openAdd} />
      
      <View style={uiStyles.section}>
        <SectionTitle>Personnel List</SectionTitle>
        {staffList.map((person) => (
          <Pressable key={person.name} onPress={() => openEdit(person)}>
            <Panel>
              <View style={uiStyles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {person.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </Text>
                </View>
                <View style={styles.info}>
                  <Text style={uiStyles.value}>{person.name}</Text>
                  <Text style={uiStyles.muted}>
                    {person.role} · {person.scope}
                  </Text>
                </View>
                <Text
                  style={{
                    ...uiStyles.muted,
                    color:
                      person.status === "Active"
                        ? colors.primary
                        : person.status === "Deactivated"
                        ? colors.destructive
                        : colors.mutedForeground,
                  }}
                >
                  {person.status}
                </Text>
              </View>
            </Panel>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.fitSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: space.md,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  info: {
    flex: 1,
  },
});
