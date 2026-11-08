import type { ReactNode } from "react";
import ApplicationLayout from "@/components/ui/ApplicationLayout";
import { appointmentsManifest } from "./manifest";

export default function AppointmentsLayout({ children }: { children: ReactNode }) {
  return <ApplicationLayout applicationId={appointmentsManifest.id}>{children}</ApplicationLayout>;
}
