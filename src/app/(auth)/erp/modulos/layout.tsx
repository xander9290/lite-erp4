import type { ReactNode } from "react";
import ApplicationLayout from "@/components/ui/ApplicationLayout";
import { modulesManifest } from "./manifest";

export default function ModulesLayout({ children }: { children: ReactNode }) {
  return <ApplicationLayout applicationId={modulesManifest.id}>{children}</ApplicationLayout>;
}
