import { Ionicons } from "@expo/vector-icons";
import { type Href, router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { LanguageToggle, Text } from "@/components/common/LocalizedText";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { roleOrder, roles } from "@/features/auth/roles";
import { colors, radius, space } from "@/config/theme";

export default function RoleSelection() {
  const [stableId, setStableId] = useState("meadowline");
  const [passcode, setPasscode] = useState("password");
  return (
    <SafeAreaView style={styles.safe}>
      <View style={{ position: "absolute", right: 18, top: 54, zIndex: 10 }}>
        <LanguageToggle />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.brand}>
            RACE<Text style={styles.brandAccent}>OS</Text>
          </Text>
          <Text style={styles.kicker}>Stable operations, in your hand</Text>
        </View>
        <View style={styles.hero}>
          <Text style={styles.title}>Choose your workspace</Text>
          <Text style={styles.copy}>
            Each role sees the same horses through the decisions they are responsible for.
          </Text>
        </View>
        <View style={styles.credentials}>
          <Text style={styles.inputLabel}>Stable ID</Text>
          <TextInput
            value={stableId}
            onChangeText={setStableId}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.inputLabel}>Passcode</Text>
          <TextInput
            value={passcode}
            onChangeText={setPasscode}
            secureTextEntry
            style={styles.input}
          />
        </View>
        <View style={styles.roles}>
          {roleOrder.map((role) => {
            const item = roles[role];
            return (
              <Pressable
                key={role}
                onPress={() => router.push(`/${role}` as Href)}
                style={({ pressed }) => [styles.role, pressed && styles.pressed]}
              >
                <View style={styles.roleIcon}>
                  <Ionicons
                    name={
                      role === "vet"
                        ? "medkit-outline"
                        : role === "groom"
                          ? "hand-left-outline"
                          : role === "owner"
                            ? "trophy-outline"
                            : role === "manager"
                              ? "business-outline"
                              : "speedometer-outline"
                    }
                    size={23}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.roleCopy}>
                  <Text style={styles.roleName}>{item.label}</Text>
                  <Text style={styles.roleScope}>
                    {item.person} · {item.scope}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={colors.muted} />
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={() => router.push("/flow")} style={styles.flow}>
          <Ionicons name="git-branch-outline" size={18} color={colors.primary} />
          <Text style={styles.flowText}>See the end-to-end stable workflow</Text>
        </Pressable>
        <Text style={styles.demo}>Prototype mode · no credentials required</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    padding: space.xl,
    gap: space.xxl,
    maxWidth: 620,
    width: "100%",
    alignSelf: "center",
  },
  brand: { color: colors.text, fontSize: 20, fontWeight: "900", letterSpacing: -0.8 },
  brandAccent: { color: colors.primary },
  kicker: { color: colors.muted, fontSize: 11, marginTop: 4 },
  hero: { marginTop: space.xl, gap: space.md },
  title: {
    color: colors.text,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    letterSpacing: -1.2,
  },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 22, maxWidth: 440 },
  credentials: { gap: space.sm },
  inputLabel: { color: colors.muted, fontSize: 11 },
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    paddingHorizontal: space.md,
  },
  roles: { gap: space.sm },
  role: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  roleIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
  },
  roleCopy: { flex: 1, gap: 4 },
  roleName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  roleScope: { color: colors.muted, fontSize: 11 },
  flow: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  flowText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  pressed: { opacity: 0.7 },
  demo: { color: colors.muted, fontSize: 11, textAlign: "center" },
});
