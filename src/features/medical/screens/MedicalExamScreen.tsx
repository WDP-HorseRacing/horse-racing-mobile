import { Redirect, type Href, useLocalSearchParams } from "expo-router";
import { isUuid } from "@/features/medical/medical-validation";

export function MedicalExamScreen() {
  const { id, view } = useLocalSearchParams<{ id: string; view?: string }>();
  const normalizedId = Array.isArray(id) ? id[0] : id;
  const normalizedView = Array.isArray(view) ? view[0] : view;

  if (!isUuid(normalizedId)) return <Redirect href="/vet/medical" />;

  if (normalizedView === "case") {
    return <Redirect href={`/vet/medical/cases/${normalizedId}` as Href} />;
  }

  return <Redirect href={`/vet/medical/visit?horseId=${normalizedId}` as Href} />;
}

export default MedicalExamScreen;
