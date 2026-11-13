import type { ReactNode } from "react";
import ApplicationLayout from "@/components/ui/ApplicationLayout";
import { accessManifest } from "./manifest";

export default function AccessLayout({ children }: { children: ReactNode }) {
  return <ApplicationLayout applicationId={accessManifest.id}>{children}</ApplicationLayout>;
}
