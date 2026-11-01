import { ChartColumnBig } from "lucide-react";
import AppContainer from "@/components/ui/AppContainer";
import AppGrid from "@/components/ui/AppGrid";

export default function PageErp() {
  return (
    <AppGrid>
      <AppContainer name="Ventas" icon={<ChartColumnBig size={26} strokeWidth={1.8} />} />
    </AppGrid>
  );
}
