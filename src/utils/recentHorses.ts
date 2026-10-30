import AsyncStorage from "@react-native-async-storage/async-storage";

const RECENT_HORSES_KEY = "@raceos_recent_created_horses";
const MAX_RECENT_HORSES = 50;

export async function rememberRecentlyCreatedHorse(id: string): Promise<void> {
  if (!id) return;
  try {
    const raw = await AsyncStorage.getItem(RECENT_HORSES_KEY);
    const existing: string[] = raw ? JSON.parse(raw) : [];
    const filtered = existing.filter((item) => item !== id);
    const updated = [id, ...filtered].slice(0, MAX_RECENT_HORSES);
    await AsyncStorage.setItem(RECENT_HORSES_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn("Failed to remember recently created horse:", error);
  }
}

export async function getRecentlyCreatedHorseIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(RECENT_HORSES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
