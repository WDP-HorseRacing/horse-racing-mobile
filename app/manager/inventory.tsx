import { useState } from "react";
import { View, StyleSheet, Pressable, Alert } from "react-native";
import { Text } from "@/components/common/LocalizedText";
import { inventory as initialInventory } from "@/lib/raceos-data";
import { Panel, PrimaryButton, Field, NativeInput, Chips, getUiStyles, Metric } from "@/components/ui";
import { Screen, SectionTitle } from "@/components/common";
import { space, radius } from "@/config/theme";
import { useTheme } from "@/hooks/useTheme";

export default function InventoryManagement() {
  const { colors } = useTheme();
  const uiStyles = getUiStyles(colors);
  const styles = getStyles(colors);

  const [inventoryList, setInventoryList] = useState(initialInventory);
  const [filter, setFilter] = useState("All");
  
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Feed");
  const [stock, setStock] = useState("");
  const [unit, setUnit] = useState("");
  const [threshold, setThreshold] = useState("");

  const filteredList = inventoryList.filter((item) =>
    filter === "All" ? true : item.category === filter
  );

  const lowStockCount = inventoryList.filter((item) => item.low).length;
  const criticalCount = inventoryList.filter((item) => item.stock === 0).length;

  const openAdd = () => {
    setName("");
    setCategory("Feed");
    setStock("");
    setUnit("");
    setThreshold("");
    setEditingItem(null);
    setIsAdding(true);
  };

  const openEdit = (item: any) => {
    setName(item.name);
    setCategory(item.category);
    setStock(item.stock.toString());
    setUnit(item.unit);
    // Rough estimate for reorder threshold based on current low status logic
    setThreshold(item.stock < 10 ? item.stock.toString() : "10");
    setEditingItem(item);
    setIsAdding(true);
  };

  const saveItem = () => {
    if (!name || !stock || !unit) {
      Alert.alert("Missing information", "Please fill in all required fields.");
      return;
    }

    const stockNum = parseInt(stock, 10) || 0;
    const thresholdNum = parseInt(threshold, 10) || 0;
    const isLow = stockNum <= thresholdNum;

    if (editingItem) {
      setInventoryList(
        inventoryList.map((i) =>
          i.name === editingItem.name
            ? { ...i, name, category, stock: stockNum, unit, low: isLow }
            : i
        )
      );
    } else {
      setInventoryList([
        ...inventoryList,
        { name, category, stock: stockNum, unit, low: isLow },
      ]);
    }
    setIsAdding(false);
  };

  const deleteItem = () => {
    Alert.alert(
      "Delete Inventory Item",
      `Are you sure you want to remove ${editingItem?.name} from the club inventory?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setInventoryList(inventoryList.filter((i) => i.name !== editingItem.name));
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
        title={editingItem ? "Edit Item" : "Add Item"}
        subtitle={editingItem ? editingItem.name : "New inventory item"}
        back
      >
        <Field label="Item Name">
          <NativeInput value={name} onChangeText={setName} placeholder="e.g. Vitamin Supplement" />
        </Field>

        <View style={uiStyles.section}>
          <SectionTitle>Category</SectionTitle>
          <Chips
            options={["Feed", "Medical", "Equipment"]}
            value={category}
            onChange={setCategory}
          />
        </View>

        <Field label="Current Quantity">
          <NativeInput
            value={stock}
            onChangeText={setStock}
            placeholder="e.g. 50"
          />
        </Field>

        <Field label="Unit">
          <NativeInput
            value={unit}
            onChangeText={setUnit}
            placeholder="e.g. kg, bottles, boxes"
          />
        </Field>
        
        <Field label="Reorder Threshold">
          <NativeInput
            value={threshold}
            onChangeText={setThreshold}
            placeholder="Warn when stock drops below this number"
          />
        </Field>

        <View style={{ height: space.md }} />
        <PrimaryButton label={editingItem ? "Save Changes" : "Add Item"} icon="checkmark" onPress={saveItem} />
        {editingItem && (
          <View style={{ marginTop: space.sm }}>
            <PrimaryButton
              label="Delete Item"
              icon="trash-outline"
              onPress={deleteItem}
            />
          </View>
        )}
      </Screen>
    );
  }

  return (
    <Screen role="manager" title="Inventory" subtitle="Manage medical supplies and feed" back>
      <View style={uiStyles.metricGrid}>
        <Metric label="Total items" value={inventoryList.length} hint="tracked" />
        <Metric label="Low stock" value={lowStockCount} hint="needs reorder" tone="warning" />
        <Metric label="Critical" value={criticalCount} hint="out of stock" tone="danger" />
      </View>

      <PrimaryButton label="Add Item" icon="add" onPress={openAdd} />
      
      <Chips
        options={["All", "Medical", "Feed", "Equipment"]}
        value={filter}
        onChange={setFilter}
      />

      <View style={uiStyles.section}>
        <SectionTitle>{filter === "All" ? "All Supplies" : filter}</SectionTitle>
        {filteredList.map((item) => (
          <Pressable key={item.name} onPress={() => openEdit(item)}>
            <Panel>
              <View style={uiStyles.row}>
                <View>
                  <Text style={uiStyles.value}>{item.name}</Text>
                  <Text style={uiStyles.muted}>{item.category}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={{
                      ...uiStyles.value,
                      color: item.low ? colors.monitor : colors.primary,
                    }}
                  >
                    {item.stock} {item.unit}
                  </Text>
                  {item.low ? (
                    <Text style={{ ...uiStyles.muted, color: colors.monitor }}>Low Stock</Text>
                  ) : (
                    <Text style={{ ...uiStyles.muted, color: colors.primary }}>In Stock</Text>
                  )}
                </View>
              </View>
            </Panel>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const getStyles = (colors: any) => StyleSheet.create({});
