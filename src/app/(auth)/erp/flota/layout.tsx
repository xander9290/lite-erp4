import type { ReactNode } from "react";
import ApplicationLayout from "@/components/ui/ApplicationLayout";
import { manifest } from "./manifest";

export default function Layout({ children }: { children: ReactNode }) {
  return <ApplicationLayout applicationId={manifest.id}>{children}</ApplicationLayout>;
}
