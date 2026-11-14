import { SharingDataProvider } from "./sharing-data-provider";
import { SharingWorkspace } from "./sharing-workspace";

export default function SharePage() {
  return (
    <SharingDataProvider>
      <SharingWorkspace />
    </SharingDataProvider>
  );
}
