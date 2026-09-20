import { useState } from "react";
import { Alert, View } from "react-native";
import { useRaceOS } from "@/context/RaceOSContext";
import { Field, NativeInput , Panel, PrimaryButton } from "@/components/ui";
import { Screen } from "@/components/common";

export default function RegisterHorse() {
  const { createHorse } = useRaceOS();
  const [name, setName] = useState("");
  const [microchip, setMicrochip] = useState("");
  const [breed, setBreed] = useState("Thoroughbred");
  const [owner, setOwner] = useState("");
  return (
    <Screen role="manager" title="Register horse" subtitle="Identity and ownership" back>
      <Panel>
        <View style={{ gap: 18 }}>
          <Field label="Horse name">
            <NativeInput value={name} onChangeText={setName} placeholder="Horse name" />
          </Field>
          <Field label="Microchip ID">
            <NativeInput
              value={microchip}
              onChangeText={setMicrochip}
              placeholder="Registry identifier"
            />
          </Field>
          <Field label="Breed">
            <NativeInput value={breed} onChangeText={setBreed} />
          </Field>
          <Field label="Primary owner">
            <NativeInput value={owner} onChangeText={setOwner} placeholder="Owner or syndicate" />
          </Field>
        </View>
      </Panel>
      <PrimaryButton
        label="Register horse"
        icon="add"
        onPress={() => {
          if (!name || !microchip) {
            Alert.alert("Missing information", "Name and microchip ID are required.");
            return;
          }
          createHorse({
            id: name
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, "-"),
            name,
            age: 3,
            breed,
            sex: "Colt",
            weight: 470,
            stall: "TBD",
            status: "FIT",
            fitness: 70,
            readiness: "Moderate",
            raceAptitude: "MILER",
            phase: "Foundation",
            lastSession: "No sessions recorded",
            owner: owner || "Unassigned",
            alerts: 0,
            hr: 88,
            color: "Bay",
            sire: "Pending registry",
            dam: "Pending registry",
          });
          Alert.alert("Horse registered", `${name} is now available in the stable roster.`);
        }}
      />
    </Screen>
  );
}
