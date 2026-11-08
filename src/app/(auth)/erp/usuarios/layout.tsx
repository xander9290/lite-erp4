import type { ReactNode } from "react";
import ApplicationLayout from "@/components/ui/ApplicationLayout";
import { usersManifest } from "./manifest";

export default function UsersLayout({ children }: { children: ReactNode }) {
  return <ApplicationLayout applicationId={usersManifest.id}>{children}</ApplicationLayout>;
}
