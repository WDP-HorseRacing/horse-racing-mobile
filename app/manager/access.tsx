import { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView, Alert } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { Panel, PrimaryButton, Chips, getUiStyles } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { space, radius } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";
import { Ionicons } from "@expo/vector-icons";
import type { RoleAccess, ActionPermission, RoleAccessScope } from "@/types/raceos";

const MOCK_ROLES: RoleAccess[] = [
  {
    id: "trainer",
    name: "Head Trainer",
    description: "Training programs and horse fitness management.",
    scope: "Entire Club",
    userCount: 3,
    permissions: {
      Horses: { view: true, create: false, edit: true, delete: false },
      Training: { view: true, create: true, edit: true, delete: true, approve: true, lock: false },
      Health: { view: true, create: false, edit: false, delete: false, lock: false },
      Staff: { view: true, create: false, edit: false, delete: false },
      Inventory: { view: true, create: false, edit: false, delete: false },
      Racing: { view: true, create: true, edit: true, delete: false, approve: false },
    },
  },
  {
    id: "vet",
    name: "Veterinarian",
    description: "Medical authority and injury management.",
    scope: "Entire Club",
    userCount: 2,
    permissions: {
      Horses: { view: true, create: false, edit: true, delete: false },
      Training: { view: true, create: false, edit: false, delete: false, lock: true },
      Health: { view: true, create: true, edit: true, delete: true, lock: true },
      Staff: { view: true, create: false, edit: false, delete: false },
      Inventory: { view: true, create: true, edit: true, delete: false },
      Racing: { view: true, create: false, edit: false, delete: false },
    },
  },
  {
    id: "groom",
    name: "Groom",
    description: "Stable operations and assigned horse care.",
    scope: "Assigned Stable",
    userCount: 15,
    permissions: {
      Horses: { view: true, create: false, edit: false, delete: false },
      Training: { view: true, create: false, edit: false, delete: false },
      Health: { view: true, create: false, edit: false, delete: false },
      Staff: { view: false, create: false, edit: false, delete: false },
      Inventory: { view: true, create: false, edit: false, delete: false },
      Racing: { view: false, create: false, edit: false, delete: false },
    },
  },
  {
    id: "owner",
    name: "Horse Owner",
    description: "View access for owned horses and reports.",
    scope: "Assigned Horses",
    userCount: 8,
    permissions: {
      Horses: { view: true, create: false, edit: false, delete: false },
      Training: { view: true, create: false, edit: false, delete: false },
      Health: { view: true, create: false, edit: false, delete: false },
      Staff: { view: false, create: false, edit: false, delete: false },
      Inventory: { view: false, create: false, edit: false, delete: false },
      Racing: { view: true, create: false, edit: false, delete: false, approve: true },
    },
  },
  {
    id: "manager",
    name: "Club Manager",
    description: "Club operations, staff, and overall administration.",
    scope: "Entire Club",
    userCount: 1,
    permissions: {
      Horses: { view: true, create: true, edit: true, delete: true },
      Training: { view: true, create: false, edit: false, delete: false },
      Health: { view: true, create: false, edit: false, delete: false },
      Staff: { view: true, create: true, edit: true, delete: true },
      Inventory: { view: true, create: true, edit: true, delete: true },
      Racing: { view: true, create: false, edit: false, delete: false },
      Reports: { view: true, create: true, edit: true, delete: false },
      Operations: { view: true, create: true, edit: true, delete: true },
    },
  },
];

export default function AccessControl() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  const [rolesList, setRolesList] = useState(MOCK_ROLES);
  const [editingRole, setEditingRole] = useState<RoleAccess | null>(null);
  
  // Form State
  const [scope, setScope] = useState<RoleAccessScope>("Entire Club");
  const [permissions, setPermissions] = useState<Record<string, ActionPermission>>({});

  const openRole = (role: RoleAccess) => {
    setEditingRole(role);
    setScope(role.scope);
    setPermissions(JSON.parse(JSON.stringify(role.permissions))); // deep copy
  };

  const saveRole = () => {
    if (editingRole) {
      setRolesList(
        rolesList.map((r) =>
          r.id === editingRole.id ? { ...r, scope, permissions: permissions as any } : r
        )
      );
      setEditingRole(null);
      Alert.alert("Permissions updated", `Access control for ${editingRole.name} saved successfully.`);
    }
  };

  const togglePermission = (category: string, action: keyof ActionPermission) => {
    setPermissions((prev) => {
      const updated = { ...prev };
      if (!updated[category]) {
        updated[category] = { view: false, create: false, edit: false, delete: false };
      }
      updated[category] = {
        ...updated[category],
        [action]: !updated[category][action],
      };
      return updated;
    });
  };

  if (editingRole) {
    return (
      <Screen role="manager" title={editingRole.name} subtitle="Configure RBAC settings" back>
        <View style={uiStyles.section}>
          <SectionTitle>Role Information</SectionTitle>
          <Panel>
            <View style={{ gap: 4 }}>
              <Text style={uiStyles.value}>{editingRole.name}</Text>
              <Text style={uiStyles.muted}>{editingRole.description}</Text>
            </View>
            <View style={{ height: space.sm }} />
            <Text style={uiStyles.muted}>{editingRole.userCount} users assigned</Text>
          </Panel>
        </View>

        <View style={uiStyles.section}>
          <SectionTitle>Access Scope</SectionTitle>
          <Chips
            options={["Entire Club", "Assigned Stable", "Assigned Horses", "Assigned Area"]}
            value={scope}
            onChange={(val) => setScope(val as RoleAccessScope)}
          />
        </View>

        <View style={uiStyles.section}>
          <SectionTitle>Permissions</SectionTitle>
          {Object.keys(permissions).map((category) => {
            const catPerms = permissions[category];
            return (
              <Panel key={category} style={{ marginBottom: space.sm }}>
                <Text style={{ ...uiStyles.value, marginBottom: space.sm }}>{category}</Text>
                
                {(["view", "create", "edit", "delete", "approve", "lock"] as (keyof ActionPermission)[]).map((action) => {
                  if (catPerms[action] !== undefined) {
                    const isOn = catPerms[action];
                    return (
                      <View key={action} style={styles.permRow}>
                        <Text style={uiStyles.muted}>
                          {action.charAt(0).toUpperCase() + action.slice(1)} {category.toLowerCase()}
                        </Text>
                        <Pressable
                          style={[styles.switch, isOn && styles.switchOn]}
                          onPress={() => togglePermission(category, action)}
                        >
                          <Text style={[styles.switchText, isOn && styles.switchTextOn]}>
                            {isOn ? "ON" : "OFF"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }
                  return null;
                })}
              </Panel>
            );
          })}
        </View>

        <View style={{ height: space.md }} />
        <PrimaryButton label="Save Changes" icon="checkmark" onPress={saveRole} />
        <PrimaryButton label="Cancel" icon="close" onPress={() => setEditingRole(null)} />
      </Screen>
    );
  }

  return (
    <Screen role="manager" title="Access Control" subtitle="Manage roles, access scope, and system permissions" back>
      <View style={uiStyles.section}>
        <SectionTitle>System Roles</SectionTitle>
        {rolesList.map((role) => {
          const permCount = Object.values(role.permissions).reduce((acc, cat) => {
            return acc + Object.values(cat).filter(Boolean).length;
          }, 0);

          return (
            <Pressable key={role.id} onPress={() => openRole(role)}>
              <Panel style={{ marginBottom: space.md }}>
                <View style={uiStyles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={uiStyles.value}>{role.name}</Text>
                    <Text style={uiStyles.muted}>{role.description}</Text>
                    <View style={{ height: space.sm }} />
                    <View style={{ flexDirection: "row", gap: space.md }}>
                      <Text style={uiStyles.muted}>Scope: {role.scope}</Text>
                      <Text style={uiStyles.muted}>•</Text>
                      <Text style={uiStyles.muted}>{permCount} permissions</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                </View>
              </Panel>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  switch: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  switchOn: {
    backgroundColor: colors.primary,
  },
  switchText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.mutedForeground,
  },
  switchTextOn: {
    color: "#FFFFFF",
  },
});
